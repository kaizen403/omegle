import type { Metadata } from 'next';
import { DocSection, PageHeader, PageShell } from '@/components/site';

export const metadata: Metadata = {
  title: 'Privacy Policy - Your Data & Anonymity | Omegle',
  description:
    'Read our privacy policy to understand how Omegle protects your data. Anonymous random video chat with no personal data required. Your privacy is our priority.',
  alternates: {
    canonical: 'https://vitap.in/privacy',
  },
  openGraph: {
    title: 'Privacy Policy | Omegle',
    description:
      'Learn how we protect your privacy during anonymous random video chat. No personal data required.',
    url: 'https://vitap.in/privacy',
    type: 'website',
  },
};

export default function PrivacyPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Privacy Policy',
    description: 'Privacy policy for Omegle random video chat platform',
    url: 'https://vitap.in/privacy',
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
          name: 'Privacy Policy',
          item: 'https://vitap.in/privacy',
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
          title="Privacy policy"
          lede="Your privacy is critically important to us. At Omegle, we have a few fundamental principles regarding your data and anonymity."
          meta="Last updated: September 4, 2026"
        />

        <DocSection title="Information we collect">
          <p>
            We collect very little information about you. We do not require you to create an account
            to use the basic features of Omegle. However, for safety, security, and moderation
            purposes:
          </p>
          <ul>
            <li>
              <strong>Log data &amp; IP addresses:</strong> We collect your IP address and browser
              user agent when you join. These are stored with an anonymous session id in our visit
              log (by Indian Standard Time date) so we can investigate abuse, enforce bans, and
              cooperate with authorities when required.
            </li>
            <li>
              <strong>Approximate location:</strong> We look up your IP with a geolocation provider
              (BigDataCloud) to record a city/region for the same abuse and moderation purposes. We
              do not use this for advertising.
            </li>
            <li>
              <strong>Chat data:</strong> Video and audio are peer-to-peer. We do not keep a durable
              chat archive after a session ends. While a room is live, authorized administrators can
              monitor it for safety; those actions are written to an internal audit log.
            </li>
            <li>
              <strong>Product analytics:</strong> We record anonymized product events (for example,
              joins and errors) to keep the service working. We do not sell this data and we do not
              show ads.
            </li>
          </ul>
        </DocSection>

        <DocSection title="Law enforcement and academic institution cooperation">
          <p>
            We cooperate fully with law enforcement agencies and academic institutions when
            necessary. If we detect illegal activities, including but not limited to child
            exploitation, severe harassment, threats of violence, or other serious violations, we
            will report your IP address and any available metadata to the appropriate authorities.
          </p>
          <p>
            We may also cooperate with college and university administrations in cases of serious
            policy violations that affect campus safety or student wellbeing.
          </p>
        </DocSection>

        <DocSection title="How we use information">
          <p>
            We use the information we collect to run matchmaking, keep the service available,
            investigate abuse, and protect users. We do not use it for advertising or sell it to
            third parties.
          </p>
        </DocSection>

        <DocSection title="Cookies">
          <p>
            We use cookies to store information about your preferences and to record user-specific
            information on visits to pages. You can choose to disable cookies through your
            individual browser options.
          </p>
        </DocSection>

        <DocSection title="Data security">
          <p>
            The security of your Personal Information is important to us, but remember that no
            method of transmission over the Internet, or method of electronic storage, is 100%
            secure. While we strive to use commercially acceptable means to protect your Personal
            Information, we cannot guarantee its absolute security.
          </p>
        </DocSection>

        <DocSection title="Third-party links">
          <p>
            Our Service may contain links to external sites that are not operated by us. If you
            click on a third-party link, you will be directed to that third party&apos;s site. We
            strongly advise you to review the Privacy Policy and terms and conditions of every site
            you visit.
          </p>
        </DocSection>

        <p className="text-text-3 mt-10 text-sm">
          This Privacy Policy is subject to change without notice. Please check back regularly for
          updates.
        </p>
      </PageShell>
    </>
  );
}
