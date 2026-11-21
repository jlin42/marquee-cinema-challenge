import { SiteHeader } from "@/components/layout/site-header";
import { MoviesScreen } from "@/features/movies/movies-screen";
import { getMoviesViewModel } from "@/features/movies/movies-view-model";

export const dynamic = "force-dynamic"; // live showtimes and seat counts
export const metadata = { title: "Movies · Marquee Cinemas" };

export default async function MoviesPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const vm = await getMoviesViewModel(date);
  return (
    <>
      <SiteHeader />
      <MoviesScreen vm={vm} />
    </>
  );
}
