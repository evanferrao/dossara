import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";

export async function GET(req: NextRequest) {
  try {
    const workspaceId = getWorkspaceId(req);
    if (!workspaceId) {
      return NextResponse.json(
        { error: "x-workspace-id header is required" },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("documents")
      .select("id, filename, status, page_count, cursor, error_message, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Documents list error:", error);
      return NextResponse.json(
        { error: "Failed to fetch documents" },
        { status: 500 }
      );
    }

    return NextResponse.json({ documents: data ?? [] });
  } catch (err) {
    console.error("Documents route error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const workspaceId = getWorkspaceId(req);
    if (!workspaceId) {
      return NextResponse.json(
        { error: "x-workspace-id header is required" },
        { status: 400 }
      );
    }

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "id query parameter is required" },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // 1. Fetch the document to verify ownership and get storage path
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, storage_path, workspace_id")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();

    if (docError || !doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // 2. Delete the file from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from("documents")
      .remove([doc.storage_path]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
      // Continue with DB cleanup even if storage delete fails
    }

    // 3. Delete chunks (FK cascade will handle this, but be explicit)
    await supabase
      .from("chunks")
      .delete()
      .eq("document_id", id);

    // 4. Delete the document row (cascade will also delete chunks if not already deleted)
    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (deleteError) {
      console.error("Document delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Document delete route error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
