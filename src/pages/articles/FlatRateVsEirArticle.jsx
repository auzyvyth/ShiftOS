import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Clock, Calendar, ChevronRight, CheckCircle } from 'lucide-react';
import MarketplaceHeader from '../../components/MarketplaceHeader';
import MarketplaceFooter from '../../components/MarketplaceFooter';
import { SITE_URL } from '../../config/site';

// English companion to AktaSewaBeli2026Article (Malay). Every number here was
// computed with src/utils/financing.js (flatToEir, monthlyPayment) on
// 2026-10-18; the Saga price is the Peninsular list price in new_car_models
// (1.5 Standard, RM38,990). No bank's rate is quoted: none could be sourced.

const ARTICLE = {
  slug: 'car-loan-malaysia-flat-rate-vs-eir',
  title: 'Car Loans in Malaysia 2026: Flat Rate vs EIR, Explained With a Proton Saga',
  description:
    'Malaysia replaced flat-rate car loans with EIR on a reducing balance from 1 June 2026. What changed, why 3.5% flat is really about 6.44% EIR, a full Proton Saga loan worked year by year, and what early settlement now saves you.',
  datePublished: '2026-10-18',
  dateModified: '2026-10-18',
  readMins: 9,
  lang: 'en', // crawler page language (api/og.js); articles without it are Malay
};

const PAGE_URL = `${SITE_URL}/articles/${ARTICLE.slug}`;

const FAQS = [
  {
    q: 'When did EIR replace flat rates for car loans in Malaysia?',
    a: 'The Hire-Purchase (Amendment) Act 2026 came into force on 1 June 2026. Banks have a transition period to 31 March 2027 to move their systems to the reducing balance method priced in EIR, so from 1 April 2027 every new car loan works this way.',
  },
  {
    q: 'What is 3.5% flat in EIR?',
    a: 'It depends on the tenure. 3.5% flat is about 6.54% EIR over 5 years, 6.44% over 7 years and 6.34% over 9 years. Those EIRs give exactly the same monthly instalment as the flat rate.',
  },
  {
    q: 'Does my monthly car loan payment go down every month under EIR?',
    a: 'No. On a fixed-rate loan the instalment stays the same every month. What changes is the split inside it: the interest part shrinks and the principal part grows as your balance falls. A variable-rate loan can change when the reference rate changes.',
  },
  {
    q: 'Does the new law change my existing car loan?',
    a: 'No. An agreement signed before 1 June 2026 is not converted. If you settle an old fixed-rate Rule of 78 loan early, banks under ABM, AIBIM and ADFIM offer eligible borrowers a goodwill discount, so the settlement comes closer to what a reducing balance loan would charge.',
  },
  {
    q: 'Does EIR apply to used cars and every brand?',
    a: 'Yes. The rules follow the hire-purchase agreement, not the car, so they cover new and used cars of any brand financed on hire purchase.',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Article',
      headline: ARTICLE.title,
      description: ARTICLE.description,
      datePublished: ARTICLE.datePublished,
      dateModified: ARTICLE.dateModified,
      author: { '@type': 'Organization', name: 'Drevo' },
      publisher: { '@type': 'Organization', name: 'Drevo', url: SITE_URL },
      url: PAGE_URL,
      inLanguage: 'en',
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQS.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
  ],
};

// Flat rate -> the EIR that gives the same instalment (flatToEir).
const FLAT_TO_EIR = [
  ['3.0%', '5 years', '5.64%'],
  ['3.0%', '7 years', '5.57%'],
  ['3.0%', '9 years', '5.50%'],
  ['3.5%', '5 years', '6.54%'],
  ['3.5%', '7 years', '6.44%'],
  ['3.5%', '9 years', '6.34%'],
];

// RM35,000 over 84 months at 6.44% EIR, RM518.75 a month, summed per year.
const SCHEDULE = [
  ['Year 1', 'RM6,225', 'RM4,090', 'RM2,135', 'RM30,910'],
  ['Year 2', 'RM6,225', 'RM4,361', 'RM1,864', 'RM26,549'],
  ['Year 3', 'RM6,225', 'RM4,650', 'RM1,575', 'RM21,899'],
  ['Year 4', 'RM6,225', 'RM4,959', 'RM1,266', 'RM16,940'],
  ['Year 5', 'RM6,225', 'RM5,288', 'RM937', 'RM11,652'],
  ['Year 6', 'RM6,225', 'RM5,639', 'RM586', 'RM6,013'],
  ['Year 7', 'RM6,225', 'RM6,013', 'RM212', 'RM0'],
];

const P = { color: '#4b5563', lineHeight: 1.75, marginBottom: 12, fontSize: 16 };
const H2 = { fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 };
const STRONG = { color: '#111827' };
const LINK = { color: '#dc2626' };
const CELL = { padding: '9px 8px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', color: '#111827', whiteSpace: 'nowrap' };
const CELL_L = { ...CELL, textAlign: 'left', color: '#374151', paddingLeft: 0 };
const TABLE_BOX = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, overflowX: 'auto' };

function Checklist({ items }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
            <CheckCircle size={13} style={{ color: '#16a34a', flexShrink: 0, marginTop: 4 }} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function FlatRateVsEirArticle() {
  return (
    <>
      <Helmet>
        <title>{ARTICLE.title} · Drevo</title>
        <meta name="description" content={ARTICLE.description} />
        <meta property="og:title" content={ARTICLE.title} />
        <meta property="og:description" content={ARTICLE.description} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={PAGE_URL} />
        <meta property="article:published_time" content={ARTICLE.datePublished} />
        <meta property="article:modified_time" content={ARTICLE.dateModified} />
        <link rel="canonical" href={PAGE_URL} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div style={{ minHeight: '100vh', background: '#F7F6F2', fontFamily: 'var(--xd-font-body)' }}>
        <MarketplaceHeader />

        <main style={{ maxWidth: 760, margin: '0 auto', padding: '72px 20px 64px' }}>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ca3af', marginBottom: 32 }}>
            <Link to="/" style={{ color: '#9ca3af', textDecoration: 'none' }}>Home</Link>
            <ChevronRight size={12} />
            <Link to="/articles" style={{ color: '#9ca3af', textDecoration: 'none' }}>Guides</Link>
            <ChevronRight size={12} />
            <span style={{ color: '#6b7280' }}>Flat rate vs EIR</span>
          </nav>

          <header style={{ marginBottom: 40 }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#dc2626', background: 'rgba(220,38,38,0.08)', padding: '4px 10px', borderRadius: 99 }}>
                Car Loans
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.8rem,5vw,2.6rem)', fontWeight: 800, color: '#111827', lineHeight: 1.15, margin: '0 0 16px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}>
              Car Loans in Malaysia 2026:<br />
              <span style={{ color: '#dc2626' }}>Flat Rate vs EIR, Explained With a Proton Saga</span>
            </h1>
            <p style={{ color: '#4b5563', fontSize: 16, lineHeight: 1.7, margin: '0 0 20px' }}>
              {ARTICLE.description}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: '#9ca3af', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={12} />
                {new Date(ARTICLE.datePublished).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={12} />
                {ARTICLE.readMins} min read
              </span>
              <span>Drevo</span>
            </div>
            <p style={{ margin: '14px 0 0', fontSize: 11, color: '#b8bcc4', fontStyle: 'italic' }}>
              This article was written by AI. It is a general guide, not legal or financial advice.
            </p>
          </header>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

            <section>
              <p style={P}>
                <strong style={STRONG}>Short answer:</strong> from 1 June 2026, new car loans in Malaysia charge interest on what you still owe (the reducing balance) and state the cost as an EIR, the effective interest rate. The old flat rate and the Rule of 78 are gone for new agreements. So when a showroom quote says "3.5%" and the bank paperwork says about 6.4%, both can describe the same monthly payment.
              </p>
              <p style={P}>
                This guide explains what changed, how to turn a flat rate into its EIR, and walks through a real loan on a new Proton Saga year by year, including what settling early now saves you.
              </p>
            </section>

            <section>
              <h2 style={H2}>The Timeline: 1 June 2026 to 31 March 2027</h2>
              <Checklist items={[
                'In force: the Hire-Purchase (Amendment) Act 2026 took effect on 1 June 2026. It amends the Hire-Purchase Act 1967, the law behind car loans.',
                'Transition: banks have until 31 March 2027 to move their systems to the reducing balance method priced in EIR. From 1 April 2027 every new car loan works this way.',
                'Progress: in September 2026 the domestic trade ministry said 14 of 20 banks already offered reducing balance financing, with the other six committed to switch by 31 December 2026.',
                'Old loans: an agreement signed before 1 June 2026 is not converted. Keep paying as normal. If you settle an old Rule of 78 loan early, ask the bank for its goodwill discount (more below).',
              ]} />
              <p style={{ ...P, marginTop: 16 }}>
                The rules follow the hire-purchase agreement, not the car. New or used, Proton, Perodua, Honda, Toyota or BYD: if you finance it on hire purchase, it is covered.
              </p>
            </section>

            <section>
              <h2 style={H2}>Flat Rate vs EIR: What Is the Difference?</h2>
              <p style={P}>
                A <strong style={STRONG}>flat rate</strong> charges interest on the full amount you first borrowed, every year, for the whole loan. Even in year 6, when you owe very little, you are still charged as if you owed it all. That is why a flat number looks low.
              </p>
              <p style={P}>
                <strong style={STRONG}>EIR on a reducing balance</strong> charges interest only on the principal you still owe. Early on the balance is large, so most of each payment is interest. Every month the balance falls, so the interest part shrinks and more of your payment clears the car itself.
              </p>
              <p style={P}>
                <strong style={STRONG}>Your monthly payment does not drop.</strong> On a fixed-rate loan you pay the same ringgit amount every month from the first to the last. Only the split inside that payment moves. (A variable-rate loan can change when the bank's reference rate changes.)
              </p>
            </section>

            <section>
              <h2 style={H2}>Why 3.5% Flat Is Not 3.5% EIR</h2>
              <p style={P}>
                To give the same monthly instalment, a flat rate has to be translated into a much higher EIR. The table shows the EIR that produces exactly the same payment as each flat rate.
              </p>
              <div style={TABLE_BOX}>
                <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse', minWidth: 300 }}>
                  <thead>
                    <tr>
                      <th style={{ ...CELL_L, fontWeight: 700, color: '#111827' }}>Flat rate</th>
                      <th style={{ ...CELL, fontWeight: 700 }}>Tenure</th>
                      <th style={{ ...CELL, fontWeight: 700 }}>Same payment in EIR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FLAT_TO_EIR.map(([f, t, e]) => (
                      <tr key={f + t}>
                        <td style={CELL_L}>{f}</td>
                        <td style={CELL}>{t}</td>
                        <td style={{ ...CELL, color: '#dc2626', fontWeight: 600 }}>{e}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ ...P, marginTop: 16 }}>
                So compare loans in one unit only. An offer of 6% EIR is cheaper than 3.5% flat over 7 years, even though the number looks higher.
              </p>
            </section>

            <section>
              <h2 style={H2}>The Legal Ceiling on Car Loan Rates</h2>
              <p style={P}>
                According to Bank Negara Malaysia's consumer guide, the maximum rate is now stated in EIR. For fixed-rate financing it is 17% a year for tenures up to five years and 16% for tenures over five years. For variable-rate financing it is 17% for every tenure. These are ceilings, not typical rates.
              </p>
            </section>

            <section>
              <h2 style={H2}>Worked Example: Financing a Proton Saga Over 7 Years</h2>
              <p style={P}>
                Take a new Proton Saga 1.5 Standard at its Peninsular list price of RM38,990. These are illustration numbers worked with the same formula as our calculator, not a quote from any bank.
              </p>
              <Checklist items={[
                'Car price: RM38,990, with a deposit of RM3,990 (about 10%)',
                'Loan amount: RM35,000 over 7 years (84 months)',
                'Rate: 3.5% flat, which is 6.44% EIR for this tenure',
                'Monthly instalment: RM518.75, the same every month',
                'Total interest: RM8,575 (RM35,000 x 3.5% x 7 years)',
              ]} />
              <p style={{ ...P, marginTop: 16 }}>
                Here is how the RM6,225 you pay each year (RM518.75 x 12) splits between the car and the bank under the reducing balance method:
              </p>
              <div style={TABLE_BOX}>
                <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse', minWidth: 460 }}>
                  <thead>
                    <tr>
                      <th style={{ ...CELL_L, fontWeight: 700, color: '#111827' }}>Year</th>
                      <th style={{ ...CELL, fontWeight: 700 }}>Paid</th>
                      <th style={{ ...CELL, fontWeight: 700 }}>To principal</th>
                      <th style={{ ...CELL, fontWeight: 700 }}>To interest</th>
                      <th style={{ ...CELL, fontWeight: 700 }}>Still owed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SCHEDULE.map(([y, paid, prin, int, bal]) => (
                      <tr key={y}>
                        <td style={CELL_L}>{y}</td>
                        <td style={CELL}>{paid}</td>
                        <td style={CELL}>{prin}</td>
                        <td style={{ ...CELL, color: '#dc2626', fontWeight: 600 }}>{int}</td>
                        <td style={CELL}>{bal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ ...P, marginTop: 16 }}>
                Interest falls from RM2,135 in year 1 to RM212 in year 7, while the payment never changes. Kept for the full 7 years, this loan costs RM8,575 in interest either way: the flat rate and its EIR equivalent are the same deal written two ways.
              </p>
            </section>

            <section>
              <h2 style={H2}>Where EIR Pays Off: Settling Early</h2>
              <p style={P}>
                The difference shows up when you clear the loan before the end, say to sell the car and upgrade, or with a bonus.
              </p>
              <p style={P}>
                Under the old <strong style={STRONG}>Rule of 78</strong>, more of the interest was counted as earned in the early months, so the interest rebate you got for settling early was smaller. On the Saga loan above, settling after 36 payments would cost about <strong style={STRONG}>RM22,075</strong>.
              </p>
              <p style={P}>
                Under the <strong style={STRONG}>reducing balance</strong> method you pay the principal still owed, which after 36 payments is <strong style={STRONG}>RM21,899</strong> (Year 3 in the table). That is about <strong style={STRONG}>RM176 less</strong> on this loan. The gap is bigger on larger loans, longer tenures and earlier settlements.
              </p>
              <p style={P}>
                These figures leave out any notice period or fees in your agreement. Before settling, ask the bank for a settlement statement. If your loan is an older Rule of 78 agreement, banks under ABM, AIBIM and ADFIM offer eligible borrowers a goodwill discount on early settlement from 1 June 2026, so the amount comes closer to the reducing balance figure.
              </p>
            </section>

            <section>
              <h2 style={H2}>Checklist Before You Sign</h2>
              <Checklist items={[
                'Compare the monthly instalment and the total amount payable first. They are the numbers that hit your account.',
                'Make sure every offer you compare is stated in EIR. A flat number next to an EIR number is not a fair comparison.',
                'Ask the bank for its Product Disclosure Sheet and check the EIR, the tenure and the total interest on it.',
                'Ask whether the rate is fixed or variable. A variable rate can change during the loan.',
                'Ask for the repayment schedule. On a reducing balance loan the interest part falls every month.',
                'Read the early settlement terms, including any notice period or charges.',
              ]} />
              <p style={{ ...P, marginTop: 16 }}>
                Rates differ by bank and by buyer: your credit record (CCRIS), income and the car all matter. Ask more than one bank for its EIR on the same loan amount and tenure, and compare like for like.
              </p>
            </section>

            <section>
              <h2 style={H2}>Work Out Your Own Instalment</h2>
              <p style={P}>
                Our <Link to="/calculator" style={{ ...LINK, fontWeight: 600 }}>car loan calculator</Link> uses EIR on a reducing balance, the method under the amended Act. Enter the price, deposit, tenure and the EIR your bank gives you. If you only have a flat rate, convert it first with the table above, because typing a flat rate into an EIR calculator gives an instalment that is too low.
              </p>
              <p style={P}>
                The result is an estimate. Approval, rate and the final instalment only come from your bank. Once you know your monthly budget, <Link to="/showroom" style={LINK}>browse cars in the showroom</Link> within that range. Prefer Malay? Read <Link to="/articles/akta-sewa-beli-2026-eir-pinjaman-kereta" style={LINK}>Akta Sewa Beli (Pindaan) 2026: Apa Berubah Untuk Pinjaman Kereta Anda</Link>.
              </p>
            </section>

            <section>
              <h2 style={{ ...H2, marginBottom: 20 }}>Frequently Asked Questions</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {FAQS.map(({ q, a }, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18 }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: 14, marginBottom: 8 }}>{q}</p>
                    <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.65, margin: 0 }}>{a}</p>
                  </div>
                ))}
              </div>
            </section>

            <div style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 14, padding: 28, textAlign: 'center' }}>
              <p style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>Work Out Your Instalment in EIR</p>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
                Our calculator uses the reducing balance method. An estimate only; your real rate comes from your bank.
              </p>
              <Link to="/calculator" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 22px', borderRadius: 10, textDecoration: 'none' }}>
                Open the Calculator
              </Link>
            </div>

          </div>
        </main>

        <MarketplaceFooter />
      </div>
    </>
  );
}
