import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Amenities } from "@/components/sections/Amenities";
import { Architecture } from "@/components/sections/Architecture";
import { Contact } from "@/components/sections/Contact";
import { Gallery } from "@/components/sections/Gallery";
import { Hero } from "@/components/sections/Hero";
import { Introduction } from "@/components/sections/Introduction";
import { Location } from "@/components/sections/Location";
import { Residences } from "@/components/sections/Residences";

export default function HomePage() {
  return (
    <>
      <Header />
      <main id="top">
        <Hero />
        <Introduction />
        <Residences />
        <Architecture />
        <Amenities />
        <Location />
        <Gallery />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
