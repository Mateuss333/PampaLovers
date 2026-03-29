import { redirect } from "next/navigation"

/** Entrada post-login: el dashboard fue retirado del MVP; Mis Lotes es la pantalla principal. */
export default function HomePage() {
  redirect("/lotes")
}
