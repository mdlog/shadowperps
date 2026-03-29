import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/landing/Hero";
import BenefitCards from "@/components/landing/BenefitCards";
import ComparisonTable from "@/components/landing/ComparisonTable";
import Architecture from "@/components/landing/Architecture";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <BenefitCards />
        <ComparisonTable />
        <Architecture />
      </main>
      <Footer />
    </>
  );
}
