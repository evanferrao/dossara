import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const workspaceId = getWorkspaceId(req);
    if (!workspaceId) {
      return NextResponse.json(
        { error: "x-workspace-id header is required" },
        { status: 400 }
      );
    }

    const { filename } = await req.json();

    if (!filename || typeof filename !== "string") {
      return NextResponse.json(
        { error: "filename is required" },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();
    const documentId = randomUUID();
    const storagePath = `${documentId}-${filename}`;

    // Create a signed upload URL so the client can PUT directly to Storage
    const { data: uploadData, error: uploadError } =
      await supabase.storage
        .from("documents")
        .createSignedUploadUrl(storagePath);

    if (uploadError) {
      console.error("Signed upload URL error:", uploadError);
      return NextResponse.json(
        { error: "Failed to create upload URL" },
        { status: 500 }
      );
    }

    // Insert the document row
    const { error: insertError } = await supabase.from("documents").insert({
      id: documentId,
      workspace_id: workspaceId,
      filename,
      storage_path: storagePath,
      status: "uploaded",
    });

    if (insertError) {
      console.error("Document insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create document record" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: uploadData.signedUrl,
      token: uploadData.token,
      documentId,
      storagePath,
    });
  } catch (err) {
    console.error("Upload URL route error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
