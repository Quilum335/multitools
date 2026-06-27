declare module "pdfjs-dist/build/pdf.mjs" {
  export const GlobalWorkerOptions: {
    workerSrc: string;
  };

  export function getDocument(source: { data: Uint8Array }): {
    promise: Promise<unknown>;
  };
}
