import { SiteHeader } from "@/components/layout/site-header";
import { FilmCarousel } from "@/features/home/film-carousel";
import { getHomeViewModel } from "@/features/home/home-view-model";

export const dynamic = "force-dynamic"; // live showtimes

export default async function HomePage() {
  const vm = await getHomeViewModel();
  return (
    <main>
      <SiteHeader overlay />
      <FilmCarousel slides={vm.slides} />
    </main>
  );
}
