import { CoffeeApp } from "./coffee-app";
import { Footer } from "./footer";

export function PageData() {
  return (
    <>
      <main className="main-app">
        <h1>Kin&apos;s Paris Coffee Shades</h1>
        <p className="tagline">Beat the locals. Catch the sun.</p>
        <CoffeeApp />
      </main>
      <Footer>
        <p>
          {"For Kin ❤️"}
        </p>
      </Footer>
    </>
  );
}