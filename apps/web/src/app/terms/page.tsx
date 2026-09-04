import type { Metadata } from 'next';
import { DocSection, PageHeader, PageShell } from '@/components/site';

export const metadata: Metadata = {
  title: 'Terms of Service - Rules & Guidelines | Omegle',
  description:
    'Read the terms of service for Omegle random video chat platform. Understand our rules, eligibility requirements, and user conduct guidelines.',
  alternates: {
    canonical: 'https://vitap.in/terms',
  },
  openGraph: {
    title: 'Terms of Service | Omegle',
    description: 'Terms and conditions for using Omegle random video chat platform.',
    url: 'https://vitap.in/terms',
    type: 'website',
  },
};

export default function TermsPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Terms of Service',
    description: 'Terms of service for Omegle random video chat platform',
    url: 'https://vitap.in/terms',
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
          name: 'Terms of Service',
          item: 'https://vitap.in/terms',
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
          title="Terms of service"
          lede="Please read these terms carefully before using Omegle. By accessing or using our service, you agree to be bound by these terms."
          meta="Last updated: November 29, 2025"
        />

        <DocSection title="Acceptance of terms">
          <p>
            By accessing and using Omegle (&quot;the Service&quot;), you accept and agree to be
            bound by the terms and provision of this agreement. In addition, when using this
            Service, you shall be subject to any posted guidelines or rules applicable to such
            services.
          </p>
        </DocSection>

        <DocSection title="Eligibility">
          <p>To use this Service, you must meet the following requirements:</p>
          <ul>
            <li>Be at least 18 years old</li>
            <li>Be a current college or university student</li>
            <li>Agree to follow all community guidelines and safety rules</li>
          </ul>
          <p>
            By using the Service, you represent and warrant that you meet these eligibility
            requirements and have the right, authority, and capacity to enter into this Agreement
            and abide by all of its terms and conditions.
          </p>
        </DocSection>

        <DocSection title="User conduct">
          <p>
            You agree to use the Service only for lawful purposes. You are strictly prohibited from
            posting on or transmitting through the Service any material that:
          </p>
          <ul>
            <li>
              <strong>Contains nudity or sexual content:</strong> Any form of nudity, sexual acts,
              or sexually explicit content is strictly prohibited and will result in an immediate
              ban.
            </li>
            <li>
              Is unlawful, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene,
              profane, hateful, or racially, ethnically, or otherwise objectionable.
            </li>
            <li>
              Encourages conduct that would constitute a criminal offense, give rise to civil
              liability, or otherwise violate any law.
            </li>
            <li>Contains advertising or any solicitation with respect to products or services.</li>
            <li>Impersonates any person or entity.</li>
          </ul>
        </DocSection>

        <DocSection title="Safety and anonymity disclaimer">
          <p>
            Interactions on Omegle are with random strangers from various colleges and universities.
            While we strive to maintain a safe environment through moderation and community
            guidelines, we cannot control the behavior of all users.
          </p>
          <p>
            You acknowledge that you are using the service at your own risk. Never share personal
            information such as your full name, address, phone number, student ID, financial
            information, or location details with strangers.
          </p>
        </DocSection>

        <DocSection title="Disclaimer of warranties">
          <p>
            The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis.
            Omegle expressly disclaims all warranties of any kind, whether express or implied,
            including, but not limited to the implied warranties of merchantability, fitness for a
            particular purpose and non-infringement.
          </p>
        </DocSection>

        <DocSection title="Limitation of liability">
          <p>
            Omegle shall not be liable for any direct, indirect, incidental, special, consequential
            or exemplary damages, including but not limited to, damages for loss of profits,
            goodwill, use, data or other intangible losses resulting from the use or the inability
            to use the service.
          </p>
        </DocSection>

        <DocSection title="Changes to terms">
          <p>
            We reserve the right, at our sole discretion, to modify or replace these Terms at any
            time. What constitutes a material change will be determined at our sole discretion.
          </p>
        </DocSection>

        <p className="text-text-3 mt-10 text-sm">
          These terms are subject to change without notice. Please check back regularly for updates.
        </p>
      </PageShell>
    </>
  );
}
