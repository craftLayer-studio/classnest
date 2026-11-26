import { Landing } from "@/components/public/Landing";
import { DEMO } from "@/server/seed";

export default function Home() {
  return <Landing entrance={`/q/${DEMO.entranceToken}`} poster={`/e/${DEMO.posterToken}`} parent="/p/demo-parent-aarav-Xk29Lq" consent="/consent/demo-consent-Meher-4kPz" />;
}
