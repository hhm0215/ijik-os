import { requirePageSession } from "@/lib/auth-session";
import DocumentImporter from "./document-importer";

export default async function ImportCardsPage() {
  await requirePageSession();

  return <DocumentImporter />;
}
