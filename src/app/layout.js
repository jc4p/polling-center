import "./globals.css";
import { FrameInit } from "@/components/FrameInit";
import { AuthProvider } from "@/lib/auth";

export const metadata = {
  title: "Polling Center",
  description: "Onchain polling platform for Farcaster",
  other: {
    'fc:frame': JSON.stringify({
      version: "next",
      imageUrl: "https://images.polling.center/polling_center_rectangle.png",
      button: {
        title: "Open Polling Center",
        action: {
          type: "launch_frame",
          name: "Polling Center",
          url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          splashImageUrl: "https://images.polling.center/polling_center_square.png",
          splashBackgroundColor: "#E9FFD8"
        }
      }
    })
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <div>
            {children}
            <FrameInit />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
