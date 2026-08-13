import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";
import { chunkPages } from "@/lib/chunker";
import { embedBatch } from "@/lib/embeddings";
import { getWorkspaceId } from "@/lib/workspace";
import { PAGES_PER_BATCH } from "@/lib/constants";

export const maxDuration = 300; // 5 minutes for large PDFs

export async function POST(req: NextRequest) {
  const supabase = getServiceSupabase();

  const workspaceId = getWorkspaceId(req);
  if (!workspaceId) {
    return NextResponse.json(
      { error: "x-workspace-id header is required" },
      { status: 400 }
    );
  }

  let documentId: string;
  try {
    const body = await req.json();
    documentId = body.documentId;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!documentId) {
    return NextResponse.json(
      { error: "documentId is required" },
      { status: 400 }
    );
  }

  try {
    // 1. Load the document row
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    if (doc.status === "ready") {
      return NextResponse.json({ status: "ready", message: "Already processed" });
    }

    // 2. Set status to processing
    if (doc.status !== "processing") {
      await supabase
        .from("documents")
        .update({ status: "processing" })
        .eq("id", documentId);
    }

    // 3. Create a signed URL and download via native fetch (more reliable for large files)
    const { data: urlData, error: urlError } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 600); // 10 min expiry

    if (urlError || !urlData?.signedUrl) {
      await supabase
        .from("documents")
        .update({ status: "failed", error_message: "Failed to create download URL" })
        .eq("id", documentId);
      return NextResponse.json(
        { error: "Failed to create download URL" },
        { status: 500 }
      );
    }

    // Download via native fetch — handles large files better than Supabase SDK
    const downloadRes = await fetch(urlData.signedUrl);
    if (!downloadRes.ok) {
      await supabase
        .from("documents")
        .update({ status: "failed", error_message: `Download failed: ${downloadRes.status}` })
        .eq("id", documentId);
      return NextResponse.json(
        { error: "Failed to download file" },
        { status: 500 }
      );
    }

    // 4. Extract ALL text at once with unpdf
    const arrayBuffer = await downloadRes.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(buffer);
    const totalPages = pdf.numPages;

    // Update page_count
    await supabase
      .from("documents")
      .update({ page_count: totalPages })
      .eq("id", documentId);

    // Extract text from all pages at once (mergePages: false → array of strings)
    const allResult = await extractText(pdf, { mergePages: false });
    const allPages: string[] = Array.isArray(allResult.text)
      ? allResult.text
      : [allResult.text];

    // 5. Process pages in batches from cursor
    const startCursor = doc.cursor || 0;

    for (let batchStart = startCursor; batchStart < totalPages; batchStart += PAGES_PER_BATCH) {
      const batchEnd = Math.min(batchStart + PAGES_PER_BATCH, totalPages);
      const batchPages = allPages.slice(batchStart, batchEnd);

      // Chunk the batch
      const chunks = chunkPages(batchPages, batchStart + 1); // pages are 1-indexed

      if (chunks.length > 0) {
        // Generate embeddings
        const embeddings = await embedBatch(chunks.map((c) => c.content));

        // Batch insert chunks
        const rows = chunks.map((chunk, i) => ({
          document_id: documentId,
          workspace_id: workspaceId,
          page_number: chunk.pageNumber,
          content: chunk.content,
          embedding: `[${embeddings[i].join(",")}]`,
        }));

        const { error: insertError } = await supabase
          .from("chunks")
          .insert(rows);

        if (insertError) {
          console.error("Chunk insert error:", insertError);
          throw new Error(`Failed to insert chunks: ${insertError.message}`);
        }
      }

      // Update cursor for progress tracking
      await supabase
        .from("documents")
        .update({ cursor: batchEnd })
        .eq("id", documentId);

      console.log(`Processed pages ${batchStart + 1}–${batchEnd} of ${totalPages}`);
    }

    // 6. Done!
    await supabase
      .from("documents")
      .update({ status: "ready", cursor: totalPages })
      .eq("id", documentId);

    return NextResponse.json({ status: "ready", totalPages });
  } catch (err) {
    console.error("Process document error:", err);

    // Set status to failed so the frontend knows
    await supabase
      .from("documents")
      .update({
        status: "failed",
        error_message:
          err instanceof Error ? err.message : "Unknown processing error",
      })
      .eq("id", documentId);

    return NextResponse.json(
      { error: "Processing failed" },
      { status: 500 }
    );
  }
}
