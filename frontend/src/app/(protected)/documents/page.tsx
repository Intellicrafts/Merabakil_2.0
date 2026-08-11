"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DocumentsDemoGrid } from "@/components/documents/documents-demo-grid";
import { DocumentsHero } from "@/components/documents/documents-hero";
import { DocumentsLibraryGrid } from "@/components/documents/documents-library-grid";
import { DocumentsUploadZone } from "@/components/documents/documents-upload-zone";
import { useToast } from "@/components/ui/toast";
import { listUserDocuments, uploadUserDocument } from "@/lib/api";
import { DEMO_DOCUMENTS, type DemoDocument } from "@/lib/demo-documents";

export default function DocumentsPage() {
  const fileClearRef = useRef(0);
  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["user-documents"],
    queryFn: () => listUserDocuments(1, 50),
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!selectedFile) throw new Error("Choose a file");
      return uploadUserDocument(selectedFile, {
        title: title || selectedFile.name,
      });
    },
    onSuccess: () => {
      toast({ title: "Document uploaded", variant: "success" });
      setTitle("");
      setSelectedFile(null);
      fileClearRef.current += 1;
      queryClient.invalidateQueries({ queryKey: ["user-documents"] });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const onUseDemo = (demo: DemoDocument) => {
    setTitle(demo.suggestedTitle);
    toast({
      title: "Template applied",
      description: "Add your PDF or text file, then upload.",
      variant: "success",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const documents = data?.items ?? [];

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-5 pb-8 md:space-y-6">
      <DocumentsHero documentCount={documents.length} />

      <div className="grid gap-5 lg:grid-cols-[340px_1fr] lg:items-start">
        <DocumentsUploadZone
          key={fileClearRef.current}
          title={title}
          onTitleChange={setTitle}
          selectedFile={selectedFile}
          onFileChange={setSelectedFile}
          isUploading={uploadMutation.isPending}
          onUpload={() => uploadMutation.mutate()}
        />

        <div className="space-y-6 min-w-0">
          <DocumentsDemoGrid demos={DEMO_DOCUMENTS} onUseDemo={onUseDemo} />
          <DocumentsLibraryGrid
            documents={documents}
            isLoading={isLoading}
            isError={isError}
            errorMessage={isError ? (error as Error).message : undefined}
          />
        </div>
      </div>
    </div>
  );
}
