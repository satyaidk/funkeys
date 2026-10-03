import Header from "@/components/Header";
import PianoApp from "@/components/PianoApp";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center">
      <Header />
      <PianoApp />
    </div>
  );
}
