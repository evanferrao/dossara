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
    let query = supabase
      .from("documents")
      .select("id, status, page_count, cursor, error_message, filename")
      .eq("id", id);

    // Scope to workspace if header is present
    if (workspaceId) {
      query = query.eq("workspace_id", workspaceId);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: data.id,
      filename: data.filename,
      status: data.status,
      pageCount: data.page_count,
      cursor: data.cursor,
      errorMessage: data.error_message,
    });
  } catch (err) {
    console.error("Document status error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
