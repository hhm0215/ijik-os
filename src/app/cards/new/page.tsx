import { requirePageSession } from "@/lib/auth-session";
import CardForm from "../card-form";

export default async function NewCardPage() {
  await requirePageSession();

  return <CardForm />;
}
