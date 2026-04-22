import { ContactForm } from "../components/ContactForm";

export default function Contact() {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:p-6 max-w-xl mx-auto w-full">
      <h1 className="text-xl md:text-2xl font-semibold mb-2">Get in Touch</h1>
      <p className="text-sm md:text-base text-foreground/60 mb-6">
        Want to chat, collaborate, or just say hi? Drop me a message.
      </p>

      <ContactForm />

      <div className="mt-8 pt-6 border-t border-foreground/10 flex flex-row flex-wrap gap-3 md:gap-4">
        <a
          href="https://www.linkedin.com/in/ivo-stoynovski-b159b8182/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-accent hover:opacity-80 transition-opacity"
        >
          LinkedIn
        </a>
        <a
          href="https://github.com/ivostoynovski"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-accent hover:opacity-80 transition-opacity"
        >
          GitHub
        </a>
      </div>
    </div>
  );
}
