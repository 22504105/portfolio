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
import { ViewingRequestProvider } from "@/components/sections/ViewingRequest";

export default function HomePage() {
  return (
    // Lets the residence details hand a viewing request to the contact form.
    <ViewingRequestProvider>
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
    </ViewingRequestProvider>
  );
}
