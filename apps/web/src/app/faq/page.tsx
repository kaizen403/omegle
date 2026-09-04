import Link from 'next/link';
import { JsonLd } from '@/components/seo/JsonLd';
import { PageHeader, PageShell } from '@/components/site';
import { faqPageJsonLd, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'FAQ',
  description:
    'Answers about how campus video chat works, privacy, safety, and what you need to get started on Omegle VITAP.',
  path: '/faq',
});

export default function FAQPage() {
  const faqCategories = [
    {
      category: 'Getting Started',
      questions: [
        {
          question: 'What is Omegle?',
          answer:
            "Omegle is a free random video chat platform where you can talk to strangers online. Connect with random people worldwide for video chat, text chat, or voice chat anonymously. It's designed specifically for college students to make new friends and have interesting conversations.",
        },
        {
          question: 'Do I need to register to use random chat?',
          answer:
            'No registration required! Simply enter your name and gender preferences, then start chatting with random strangers immediately. We value your privacy and make it easy to jump right into conversations.',
        },
        {
          question: 'How does random video chat work?',
          answer:
            "Click 'Start Chat' and you'll be instantly connected with a random stranger for video chat. If you want to talk to someone else, just click 'Next' to skip to the next person. It's that simple!",
        },
      ],
    },
    {
      category: 'Pricing & Features',
      questions: [
        {
          question: 'Is Omegle free?',
          answer:
            'Yes! Omegle is completely free to use. No registration, no subscription, no hidden fees. Start random video chat with strangers instantly without any cost, forever.',
        },
        {
          question: 'Can I use text chat instead of video?',
          answer:
            'Yes! You can toggle your camera off and use text-only chat to talk to strangers if you prefer anonymous text messaging. You also have full control over your microphone settings.',
        },
        {
          question: 'Can I choose who I talk to?',
          answer:
            'You can select gender preferences before starting. Our algorithm matches you with random strangers based on your preferences for the best chat experience. However, matches are still random within your selected preferences.',
        },
      ],
    },
    {
      category: 'Safety & Privacy',
      questions: [
        {
          question: 'Is stranger chat safe and anonymous?',
          answer:
            'We prioritize your privacy. Chats are anonymous and not recorded. However, always follow our community guidelines and never share personal information with strangers. Your safety is in your hands.',
        },
        {
          question: 'How do you protect my privacy?',
          answer:
            "We don't store chat logs or video recordings. No personal data is required to use the platform. Connections are peer-to-peer whenever possible, and we use end-to-end encryption for all communications.",
        },
        {
          question: 'What should I do if someone behaves inappropriately?',
          answer:
            "Click 'Next' immediately to disconnect from that person. You can also report violations through our community guidelines. We have a zero-tolerance policy for harassment and illegal content.",
        },
      ],
    },
    {
      category: 'Technical Support',
      questions: [
        {
          question: 'What browsers are supported?',
          answer:
            'Omegle works best on modern browsers like Chrome, Firefox, Safari, and Edge. Make sure your browser has permission to access your camera and microphone.',
        },
        {
          question: "Why can't others see or hear me?",
          answer:
            'Check if your browser has permission to access your camera and microphone. Also verify that no other application is using your devices. Try refreshing the page or restarting your browser if issues persist.',
        },
        {
          question: 'What makes this different from other chat platforms?',
          answer:
            "Omegle offers an authentic random chat experience with improved performance, better matching algorithm, enhanced safety features, and a modern interface designed for today's college students.",
        },
      ],
    },
  ];

  return (
    <>
      <JsonLd data={faqPageJsonLd(faqCategories.flatMap((category) => category.questions))} />
      <PageShell width="wide">
        <PageHeader
          align="center"
          title="Questions? Answers."
          lede="Everything you need to know about random video chat, stranger chat, and how to use Omegle"
        />

        {faqCategories.map((category) => (
          <section key={category.category} className="mt-12 first:mt-0">
            <h2 className="text-text text-2xl font-bold tracking-tight">{category.category}</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {category.questions.map((faq) => (
                <div key={faq.question} className="bg-sky rounded-2xl p-5">
                  <h3 className="text-text font-semibold">{faq.question}</h3>
                  <p className="text-text-2 mt-2 text-[15px] leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="bg-blue-softer mt-16 rounded-2xl p-8 text-center">
          <h2 className="text-text text-2xl font-bold">Ready to say hi?</h2>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/welcome"
              className="bg-blue hover:bg-blue-dark inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white transition-colors"
            >
              Start chatting
            </Link>
            <Link
              href="/community-guidelines"
              className="bg-surface hover:bg-blue-soft text-blue-dark inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors"
            >
              Read the guidelines
            </Link>
          </div>
        </section>
      </PageShell>
    </>
  );
}
