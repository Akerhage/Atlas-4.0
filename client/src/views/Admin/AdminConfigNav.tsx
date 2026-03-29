interface Props {
  selectedSection: string | null
  onSelectSection: (section: string) => void
}

const CONFIG_SECTIONS = [
  { key: 'drift', label: 'Drift & Säkerhet', icon: '🛡️' },
  { key: 'email', label: 'E-post & IMAP', icon: '📧' },
  { key: 'network', label: 'Nätverk', icon: '🌐' },
  { key: 'ai', label: 'AI & LLM', icon: '🤖' },
  { key: 'rag', label: 'RAG-Scoring', icon: '📊' },
  { key: 'booking', label: 'Bokningslänkar', icon: '🔗' },
  { key: 'ts-urls', label: 'Transportstyrelsen', icon: '🏛️' },
  { key: 'knowledge', label: 'Kunskapsbas', icon: '📚' },
  { key: 'gaps', label: 'Kunskapsluckor', icon: '🔍' },
  { key: 'about', label: 'Om Atlas', icon: 'ℹ️' },
]

export default function AdminConfigNav({ selectedSection, onSelectSection }: Props) {
  return (
    <div className="admin-main-list">
      <div className="admin-list-title">
        <span>Systemkonfiguration</span>
      </div>
      <div className="admin-list-scroll">
        {CONFIG_SECTIONS.map(section => (
          <div
            key={section.key}
            className={`admin-sysconfig-nav-item admin-mini-card${selectedSection === section.key ? ' selected' : ''}`}
            onClick={() => onSelectSection(section.key)}
            style={{ cursor: 'pointer' }}
          >
            <span style={{ fontSize: 18, width: 32, textAlign: 'center', flexShrink: 0 }}>
              {section.icon}
            </span>
            <span className="admin-card-name" style={{ fontSize: 13 }}>
              {section.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
