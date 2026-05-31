import React, { useState } from 'react';
import {
  TrendingUp, Users, Car, CreditCard, AlertTriangle, CheckCircle2,
  Plus, Download, Trash2, Filter,
} from 'lucide-react';
import { Card, Button, Stat, Badge, SectionHeader, SubTabBar, color, font, space, shadow, radius } from '../components/ui';

// Living style guide for the premium-light design system. Open /style-guide on
// any deploy to review every primitive before migrating real tabs onto them.
export default function StyleGuidePage() {
  const [sub, setSub] = useState('overview');

  return (
    <div style={{ minHeight: '100vh', background: color.appBg, fontFamily: font.family, padding: '40px 32px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        <div style={{ marginBottom: space[8] }}>
          <Badge tone="ink">Design System</Badge>
          <h1 style={{ margin: '12px 0 4px', fontSize: font.size['3xl'], fontWeight: font.weight.bold, color: color.ink, letterSpacing: -0.5 }}>
            ShiftOS — Premium Light
          </h1>
          <p style={{ margin: 0, fontSize: font.size.lg, color: color.textSecondary }}>
            Soft surfaces, calm near-black primary, red reserved for alerts. One typeface, varied weight.
          </p>
        </div>

        {/* KPI row */}
        <Section label="KPI tiles">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: space[4] }}>
            <Stat label="Gross MTD" value="RM 184k" delta="+12%" deltaDir="up" icon={TrendingUp} />
            <Stat label="Units Sold" value="27" delta="+4" deltaDir="up" icon={Car} />
            <Stat label="Active Leads" value="63" delta="-5" deltaDir="down" icon={Users} />
            <Stat label="HP Pending" value="9" hint="Awaiting bank decision" icon={CreditCard} />
          </div>
        </Section>

        {/* Buttons */}
        <Section label="Buttons">
          <div style={{ display: 'flex', gap: space[3], flexWrap: 'wrap', alignItems: 'center' }}>
            <Button variant="primary" icon={Plus}>Add Listing</Button>
            <Button variant="secondary" icon={Download}>Export</Button>
            <Button variant="ghost" icon={Filter}>Filter</Button>
            <Button variant="danger" icon={Trash2}>Delete</Button>
            <Button variant="primary" size="sm">Small</Button>
            <Button variant="secondary" size="sm">Small</Button>
            <Button variant="primary" disabled>Disabled</Button>
          </div>
        </Section>

        {/* Badges */}
        <Section label="Status badges">
          <div style={{ display: 'flex', gap: space[2], flexWrap: 'wrap' }}>
            <Badge tone="neutral">Draft</Badge>
            <Badge tone="success" icon={CheckCircle2}>Approved</Badge>
            <Badge tone="warning">Pending</Badge>
            <Badge tone="danger" icon={AlertTriangle}>Rejected</Badge>
            <Badge tone="info">Submitted</Badge>
            <Badge tone="ink">Disbursed</Badge>
          </div>
        </Section>

        {/* Sub tabs + card content */}
        <Section label="Sub-tabs + content card">
          <Card padding={6}>
            <SectionHeader
              title="Analytics"
              subtitle="Listings, revenue & marketplace traffic"
              actions={<><Button variant="ghost" size="sm" icon={Filter}>Filter</Button><Button variant="secondary" size="sm" icon={Download}>Export</Button></>}
            />
            <SubTabBar
              active={sub}
              onChange={setSub}
              tabs={[{ id: 'overview', label: 'Overview' }, { id: 'revenue', label: 'Revenue' }, { id: 'traffic', label: 'Marketplace' }]}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: space[4] }}>
              <Stat label="Views" value="12,480" delta="+8%" deltaDir="up" />
              <Stat label="Enquiries" value="312" delta="+2%" deltaDir="up" />
              <Stat label="Conversion" value="2.5%" delta="-0.3%" deltaDir="down" />
            </div>
          </Card>
        </Section>

        {/* Elevation / table-ish row */}
        <Section label="List rows (whitespace + hover, no borders)">
          <Card padding={2}>
            {[
              { car: 'Toyota Alphard 2.5L', year: 2022, price: 'RM 268,000', status: 'Available', tone: 'success' },
              { car: 'Lexus RX350 F-Sport', year: 2023, price: 'RM 395,000', status: 'Reserved', tone: 'warning' },
              { car: 'Porsche Cayenne 3.0', year: 2022, price: 'RM 520,000', status: 'Sold', tone: 'neutral' },
            ].map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 12px', borderTop: i ? `1px solid ${color.border}` : 'none',
              }}>
                <div>
                  <div style={{ fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink }}>{r.car}</div>
                  <div style={{ fontSize: font.size.sm, color: color.textMuted }}>{r.year}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: space[4] }}>
                  <span style={{ fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink, ...font.numeric }}>{r.price}</span>
                  <Badge tone={r.tone}>{r.status}</Badge>
                </div>
              </div>
            ))}
          </Card>
        </Section>

        {/* Palette */}
        <Section label="Palette">
          <div style={{ display: 'flex', gap: space[3], flexWrap: 'wrap' }}>
            {[
              ['App BG', color.appBg], ['Surface', color.surface], ['Ink (primary)', color.primary],
              ['Text', color.text], ['Secondary', color.textSecondary], ['Muted', color.textMuted],
              ['Accent / Danger', color.accent], ['Success', color.success], ['Warning', color.warning], ['Info', color.info],
            ].map(([name, val]) => (
              <div key={name} style={{ width: 100 }}>
                <div style={{ height: 48, borderRadius: radius.md, background: val, boxShadow: shadow.xs, border: `1px solid ${color.border}` }} />
                <div style={{ marginTop: 6, fontSize: font.size.xs, fontWeight: font.weight.semibold, color: color.text }}>{name}</div>
                <div style={{ fontSize: font.size.xs, color: color.textMuted, ...font.numeric }}>{val}</div>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: space[10] }}>
      <div style={{
        fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.textMuted,
        textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: space[4],
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}
