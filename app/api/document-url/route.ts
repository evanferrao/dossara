import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";

export async function GET(req: NextRequest) {
  const workspaceId = getWorkspaceId(req);
  const id = req.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const supabase = getServiceSupabase();

    // Get the document to find the storage path
    let query = supabase
      .from("documents")
      .select("storage_path")
      .eq("id", id);

    // Scope to workspace if header is present
    if (workspaceId) {
      query = query.eq("workspace_id", workspaceId);
    }

    const { data: doc, error: docError } = await query.single();

    if (docError || !doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Create a short-lived signed URL for the PDF
    const { data: urlData, error: urlError } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 3600); // 1 hour expiry

    if (urlError || !urlData) {
      return NextResponse.json(
        { error: "Failed to create download URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: urlData.signedUrl });
  } catch (err) {
    console.error("Document URL error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
