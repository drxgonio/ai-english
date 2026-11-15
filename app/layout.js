import "./globals.css";

export const metadata = {
  title: "SpeakFlow — AI English Speaking Coach",
  description:
    "Practise spoken English with an AI coach: Whisper transcribes your voice, GPT-4o replies and grades your grammar and vocabulary, and OpenAI TTS reads the answer aloud.",
  applicationName: "SpeakFlow",
  keywords: [
    "English speaking",
    "AI tutor",
    "Whisper",
    "GPT-4o",
    "pronunciation practice",
  ],
};

export const viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-dvh bg-slate-950 font-sans text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
