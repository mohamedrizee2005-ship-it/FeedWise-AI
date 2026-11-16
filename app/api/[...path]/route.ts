import { env } from "cloudflare:workers";
import { handleAPI } from "../../../lib/service.mjs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return handleAPI(request, env.DB);
}
export function POST(request: Request) {
  return handleAPI(request, env.DB);
}
export function PATCH(request: Request) {
  return handleAPI(request, env.DB);
}
