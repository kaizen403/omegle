import type { Metadata } from 'next';
import { DocSection, PageHeader, PageShell } from '@/components/site';

export const metadata: Metadata = {
  title: 'Community Guidelines - Safe Chat Rules | Omegle',
  description:
    "Community guidelines for safe random video chatting. Learn the do's and don'ts for a positive experience on Omegle. Zero tolerance for harassment.",
  alternates: {
    canonical: 'https://vitap.in/community-guidelines',
  },
  openGraph: {
    title: 'Community Guidelines | Omegle',
    description: 'Guidelines for safe and respectful random video chat on Omegle.',
    url: 'https://vitap.in/community-guidelines',
    type: 'website',
  },
};

const CAMPUSES = ['VIT-AP', 'SRM-AP', 'NID-AP'];

export default function CommunityGuidelinesPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Community Guidelines',
    description: 'Community guidelines for safe random video chatting on Omegle',
    url: 'https://vitap.in/community-guidelines',
    isPartOf: {
      '@type': 'WebSite',
      name: 'Omegle',
      url: 'https://vitap.in',
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://vitap.in' },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Community Guidelines',
          item: 'https://vitap.in/community-guidelines',
        },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <PageShell>
        <PageHeader
          title="Community guidelines"
          lede="Omegle is a community for college and university students to connect, make friends, and have meaningful conversations. To keep this community safe, respectful, and enjoyable for everyone, we ask that you follow these guidelines."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bg-green-soft rounded-2xl p-6">
            <h2 className="text-green text-base font-semibold">Do</h2>
            <ul className="text-text-2 mt-3 list-disc space-y-2 pl-5 text-[15px] marker:text-current">
              <li>Be respectful and kind to strangers.</li>
              <li>Keep conversations friendly and open.</li>
              <li>Report inappropriate behavior immediately.</li>
              <li>Protect your personal information.</li>
            </ul>
          </div>

          <div className="bg-red-soft rounded-2xl p-6">
            <h2 className="text-red text-base font-semibold">Don&apos;t</h2>
            <ul className="text-text-2 mt-3 list-disc space-y-2 pl-5 text-[15px] marker:text-current">
              <li className="text-text font-semibold">No nudity or sexual content.</li>
              <li>Bully, harass, or threaten others.</li>
              <li>Share explicit or illegal content.</li>
              <li>Spam or advertise products/services.</li>
              <li>Impersonate staff or other students.</li>
            </ul>
          </div>
        </div>

        <div className="mt-10">
          <DocSection title="Safety tips">
            <p>
              While we strive to create a safe environment, you are chatting with strangers. Please
              follow these safety guidelines:
            </p>
            <ul>
              <li>
                <strong>Never share personal details:</strong> Do not reveal your full name, phone
                number, address, dorm location, class schedule, or social media handles.
              </li>
              <li>
                <strong>Protect your identity:</strong> Avoid sharing your college name, student ID,
                or any information that could identify your campus location.
              </li>
              <li>
                <strong>Be careful with links:</strong> Do not click on links sent by strangers as
                they may be malicious or phishing attempts.
              </li>
              <li>
                <strong>Trust your instincts:</strong> If a conversation makes you uncomfortable,
                disconnect immediately. Your comfort and safety come first.
              </li>
              <li>
                <strong>Report violations:</strong> If someone violates these guidelines, disconnect
                and report the behavior if possible.
              </li>
            </ul>
          </DocSection>

          <DocSection title="Zero tolerance">
            <p>
              We have a zero-tolerance policy for harassment, hate speech, and illegal content.
              Users found violating these rules will be permanently banned from the platform. We
              cooperate with college administration and law enforcement when necessary.
            </p>
          </DocSection>

          <DocSection title="Reporting">
            <p>
              If you encounter someone violating these guidelines, please disconnect immediately.
              Your safety is our priority.
            </p>
          </DocSection>

          <DocSection title="Need help?">
            <p>If you are in immediate danger or need urgent assistance, please contact:</p>
            <ul>
              <li>Your campus security office</li>
              <li>Local emergency services (911)</li>
              <li>Campus counseling or student support services</li>
              <li>Title IX office for harassment or discrimination issues</li>
            </ul>
          </DocSection>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-2">
          <span className="text-text-3 mr-1 text-sm">Campuses</span>
          {CAMPUSES.map((campus) => (
            <span
              key={campus}
              className="bg-blue-softer text-blue-dark rounded-full px-4 py-1.5 text-sm font-semibold"
            >
              {campus}
            </span>
          ))}
        </div>
      </PageShell>
    </>
  );
}
