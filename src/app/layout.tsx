import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Celebrio — AI Celebration Planner",
  description: "Your celebration, thoughtfully planned. Plan weddings, birthdays, and community events with AI-powered budgets, timelines, vendor checklists, and personalized ideas.",
  keywords: ["event planner", "celebration", "wedding planner", "birthday planner", "AI planning", "budget", "timeline"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] btn btn-primary">
          Skip to main content
        </a>
        <div id="main-content">
          {children}
        </div>
      </body>
    </html>
  );
}
