import { createFileRoute } from "@tanstack/react-router";
import { handleNovac } from "@/lib/novac/client.server";

const handle = ({ request }: { request: Request }) => handleNovac(request);

export const Route = createFileRoute("/api/novac/$action")({
  server: { handlers: { GET: handle, POST: handle } },
});
