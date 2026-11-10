import { NextResponse } from "next/server";
import { nomeCookie, type Area } from "@/lib/auth";

export async function POST(req: Request) {
  const form = await req.formData();
  const area: Area = form.get("area") === "entregador" ? "entregador" : "painel";
  const res = new NextResponse(null, { status: 303, headers: { Location: `/${area}/entrar` } });
  res.cookies.delete(nomeCookie(area));
  return res;
}
