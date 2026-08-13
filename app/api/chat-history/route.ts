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
      .from("chat_messages")
      .select("id, role, content, citations, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Chat history error:", error);
      return NextResponse.json(
        { error: "Failed to fetch chat history" },
        { status: 500 }
      );
    }

    return NextResponse.json({ messages: data ?? [] });
  } catch (err) {
    console.error("Chat history route error:", err);
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

    const supabase = getServiceSupabase();

    const { error } = await supabase
      .from("chat_messages")
      .delete()
      .eq("workspace_id", workspaceId);

    if (error) {
      console.error("Clear chat error:", error);
      return NextResponse.json(
        { error: "Failed to clear chat history" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Clear chat route error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
