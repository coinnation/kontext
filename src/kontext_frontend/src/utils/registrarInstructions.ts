// DNS Configuration Instructions for Top Domain Registrars

export interface RegistrarInstruction {
  name: string;
  icon: string;
  steps: Array<{
    number: number;
    title: string;
    description: string;
    details?: string[];
  }>;
  dnsSettingsUrl?: string;
  supportUrl?: string;
}

export const REGISTRAR_INSTRUCTIONS: Record<string, RegistrarInstruction> = {
  namesilo: {
    name: 'NameSilo',
    icon: '🌐',
    steps: [
      {
        number: 1,
        title: 'Log in to NameSilo',
        description: 'Go to namesilo.com and log in to your account',
        details: ['Navigate to the DNS Manager section']
      },
      {
        number: 2,
        title: 'Select Your Domain',
        description: 'Click on the domain you want to configure',
        details: ['Find your domain in the domain list']
      },
      {
        number: 3,
        title: 'Access DNS Records',
        description: 'Click on "DNS Records" or "Manage DNS"',
        details: ['You may need to enable "Use Custom DNS" if using default nameservers']
      },
      {
        number: 4,
        title: 'Add A Record',
        description: 'Add an A record with the following values:',
        details: [
          'Host: @ (or leave blank)',
          'Value: [ICP IPv4 Address]',
          'TTL: 3600 (or default)'
        ]
      },
      {
        number: 5,
        title: 'Add AAAA Record',
        description: 'Add an AAAA record with the following values:',
        details: [
          'Host: @ (or leave blank)',
          'Value: [ICP IPv6 Address]',
          'TTL: 3600 (or default)'
        ]
      },
      {
        number: 6,
        title: 'Save Changes',
        description: 'Click "Submit" or "Save" to apply the DNS changes',
        details: ['Wait for DNS propagation (typically 5-60 minutes)']
      }
    ],
    dnsSettingsUrl: 'https://www.namesilo.com/account_domain_manage_dns.php',
    supportUrl: 'https://www.namesilo.com/support'
  },
  namecheap: {
    name: 'Namecheap',
    icon: '🏷️',
    steps: [
      {
        number: 1,
        title: 'Log in to Namecheap',
        description: 'Go to namecheap.com and log in to your account',
        details: []
      },
      {
        number: 2,
        title: 'Go to Domain List',
        description: 'Click on "Domain List" from the dashboard',
        details: []
      },
      {
        number: 3,
        title: 'Select Your Domain',
        description: 'Click "Manage" next to your domain',
        details: []
      },
      {
        number: 4,
        title: 'Access Advanced DNS',
        description: 'Navigate to the "Advanced DNS" tab',
        details: ['Make sure you\'re using Namecheap BasicDNS or PremiumDNS']
      },
      {
        number: 5,
        title: 'Add A Record',
        description: 'Click "Add New Record" and select A Record:',
        details: [
          'Host: @',
          'Value: [ICP IPv4 Address]',
          'TTL: Automatic (or 30 min)'
        ]
      },
      {
        number: 6,
        title: 'Add AAAA Record',
        description: 'Click "Add New Record" and select AAAA Record:',
        details: [
          'Host: @',
          'Value: [ICP IPv6 Address]',
          'TTL: Automatic (or 30 min)'
        ]
      },
      {
        number: 7,
        title: 'Save Changes',
        description: 'Click the checkmark to save each record',
        details: ['Changes typically propagate within 30 minutes']
      }
    ],
    dnsSettingsUrl: 'https://www.namecheap.com/myaccount/login.aspx',
    supportUrl: 'https://www.namecheap.com/support/'
  },
  godaddy: {
    name: 'GoDaddy',
    icon: '🐐',
    steps: [
      {
        number: 1,
        title: 'Log in to GoDaddy',
        description: 'Go to godaddy.com and log in to your account',
        details: []
      },
      {
        number: 2,
        title: 'Access My Products',
        description: 'Click on "My Products" from the dashboard',
        details: []
      },
      {
        number: 3,
        title: 'Select Your Domain',
        description: 'Find your domain and click "DNS" or the three dots menu → "Manage DNS"',
        details: []
      },
      {
        number: 4,
        title: 'Add A Record',
        description: 'In the Records section, click "Add" and select A:',
        details: [
          'Name: @',
          'Value: [ICP IPv4 Address]',
          'TTL: 600 seconds (or default)'
        ]
      },
      {
        number: 5,
        title: 'Add AAAA Record',
        description: 'Click "Add" again and select AAAA:',
        details: [
          'Name: @',
          'Value: [ICP IPv6 Address]',
          'TTL: 600 seconds (or default)'
        ]
      },
      {
        number: 6,
        title: 'Save Changes',
        description: 'Click "Save" to apply the DNS changes',
        details: ['Propagation usually takes 15-60 minutes']
      }
    ],
    dnsSettingsUrl: 'https://sso.godaddy.com/',
    supportUrl: 'https://www.godaddy.com/help'
  },
  cloudflare: {
    name: 'Cloudflare',
    icon: '☁️',
    steps: [
      {
        number: 1,
        title: 'Log in to Cloudflare',
        description: 'Go to cloudflare.com and log in to your account',
        details: []
      },
      {
        number: 2,
        title: 'Select Your Domain',
        description: 'Click on your domain from the dashboard',
        details: []
      },
      {
        number: 3,
        title: 'Go to DNS Settings',
        description: 'Click on the "DNS" tab in the left sidebar',
        details: []
      },
      {
        number: 4,
        title: 'Add A Record',
        description: 'Click "Add record" and configure:',
        details: [
          'Type: A',
          'Name: @ (or your domain)',
          'IPv4 address: [ICP IPv4 Address]',
          'Proxy status: DNS only (gray cloud)',
          'TTL: Auto'
        ]
      },
      {
        number: 5,
        title: 'Add AAAA Record',
        description: 'Click "Add record" again and configure:',
        details: [
          'Type: AAAA',
          'Name: @ (or your domain)',
          'IPv6 address: [ICP IPv6 Address]',
          'Proxy status: DNS only (gray cloud)',
          'TTL: Auto'
        ]
      },
      {
        number: 6,
        title: 'Save Changes',
        description: 'Changes are saved automatically',
        details: ['Cloudflare typically propagates DNS changes within 5 minutes']
      }
    ],
    dnsSettingsUrl: 'https://dash.cloudflare.com/',
    supportUrl: 'https://support.cloudflare.com/'
  },
  namecom: {
    name: 'Name.com',
    icon: '📝',
    steps: [
      {
        number: 1,
        title: 'Log in to Name.com',
        description: 'Go to name.com and log in to your account',
        details: []
      },
      {
        number: 2,
        title: 'Access Domain Management',
        description: 'Click on "My Domains" or your domain name',
        details: []
      },
      {
        number: 3,
        title: 'Go to DNS Records',
        description: 'Click on "DNS Records" or "Manage DNS Records"',
        details: []
      },
      {
        number: 4,
        title: 'Add A Record',
        description: 'Click "Add Record" and select A:',
        details: [
          'Host: @',
          'Answer: [ICP IPv4 Address]',
          'TTL: 3600'
        ]
      },
      {
        number: 5,
        title: 'Add AAAA Record',
        description: 'Click "Add Record" and select AAAA:',
        details: [
          'Host: @',
          'Answer: [ICP IPv6 Address]',
          'TTL: 3600'
        ]
      },
      {
        number: 6,
        title: 'Save Changes',
        description: 'Click "Save" to apply the DNS changes',
        details: ['DNS propagation typically takes 15-60 minutes']
      }
    ],
    dnsSettingsUrl: 'https://www.name.com/account',
    supportUrl: 'https://www.name.com/support'
  },
  porkbun: {
    name: 'Porkbun',
    icon: '🐷',
    steps: [
      {
        number: 1,
        title: 'Log in to Porkbun',
        description: 'Go to porkbun.com and log in to your account',
        details: []
      },
      {
        number: 2,
        title: 'Access Domain Management',
        description: 'Click on your domain name or "DNS"',
        details: []
      },
      {
        number: 3,
        title: 'Edit DNS Records',
        description: 'Click "Edit" next to DNS Records',
        details: []
      },
      {
        number: 4,
        title: 'Add A Record',
        description: 'Add a new A record:',
        details: [
          'Hostname: @',
          'Type: A',
          'Answer: [ICP IPv4 Address]',
          'TTL: 300'
        ]
      },
      {
        number: 5,
        title: 'Add AAAA Record',
        description: 'Add a new AAAA record:',
        details: [
          'Hostname: @',
          'Type: AAAA',
          'Answer: [ICP IPv6 Address]',
          'TTL: 300'
        ]
      },
      {
        number: 6,
        title: 'Save Changes',
        description: 'Click "Save" to apply the DNS changes',
        details: ['DNS changes typically propagate within 5-30 minutes']
      }
    ],
    dnsSettingsUrl: 'https://porkbun.com/account',
    supportUrl: 'https://porkbun.com/support'
  },
  google: {
    name: 'Google Domains',
    icon: '🔍',
    steps: [
      {
        number: 1,
        title: 'Log in to Google Domains',
        description: 'Go to domains.google.com and log in',
        details: []
      },
      {
        number: 2,
        title: 'Select Your Domain',
        description: 'Click on your domain name',
        details: []
      },
      {
        number: 3,
        title: 'Access DNS Settings',
        description: 'Click on "DNS" in the left sidebar',
        details: []
      },
      {
        number: 4,
        title: 'Add A Record',
        description: 'Scroll to "Custom resource records" and add:',
        details: [
          'Name: @',
          'Type: A',
          'Data: [ICP IPv4 Address]',
          'TTL: 3600'
        ]
      },
      {
        number: 5,
        title: 'Add AAAA Record',
        description: 'Add another record:',
        details: [
          'Name: @',
          'Type: AAAA',
          'Data: [ICP IPv6 Address]',
          'TTL: 3600'
        ]
      },
      {
        number: 6,
        title: 'Save Changes',
        description: 'Click "Save" to apply changes',
        details: ['Changes typically propagate within 15-60 minutes']
      }
    ],
    dnsSettingsUrl: 'https://domains.google.com/registrar',
    supportUrl: 'https://support.google.com/domains'
  },
  hover: {
    name: 'Hover',
    icon: '🎯',
    steps: [
      {
        number: 1,
        title: 'Log in to Hover',
        description: 'Go to hover.com and log in to your account',
        details: []
      },
      {
        number: 2,
        title: 'Select Your Domain',
        description: 'Click on your domain name',
        details: []
      },
      {
        number: 3,
        title: 'Access DNS Settings',
        description: 'Click on "DNS" tab',
        details: []
      },
      {
        number: 4,
        title: 'Add A Record',
        description: 'Click "Add" and configure:',
        details: [
          'Hostname: @',
          'Type: A',
          'Value: [ICP IPv4 Address]',
          'TTL: 3600'
        ]
      },
      {
        number: 5,
        title: 'Add AAAA Record',
        description: 'Click "Add" again and configure:',
        details: [
          'Hostname: @',
          'Type: AAAA',
          'Value: [ICP IPv6 Address]',
          'TTL: 3600'
        ]
      },
      {
        number: 6,
        title: 'Save Changes',
        description: 'Click "Save DNS" to apply changes',
        details: ['DNS propagation typically takes 15-60 minutes']
      }
    ],
    dnsSettingsUrl: 'https://www.hover.com/control_panel',
    supportUrl: 'https://help.hover.com/'
  },
  dynadot: {
    name: 'Dynadot',
    icon: '⚡',
    steps: [
      {
        number: 1,
        title: 'Log in to Dynadot',
        description: 'Go to dynadot.com and log in to your account',
        details: []
      },
      {
        number: 2,
        title: 'Access Domain Management',
        description: 'Click on "My Domains" and select your domain',
        details: []
      },
      {
        number: 3,
        title: 'Go to DNS Settings',
        description: 'Click on "DNS" tab',
        details: []
      },
      {
        number: 4,
        title: 'Add A Record',
        description: 'Click "Add Record" and select A:',
        details: [
          'Host: @',
          'Points to: [ICP IPv4 Address]',
          'TTL: 3600'
        ]
      },
      {
        number: 5,
        title: 'Add AAAA Record',
        description: 'Click "Add Record" and select AAAA:',
        details: [
          'Host: @',
          'Points to: [ICP IPv6 Address]',
          'TTL: 3600'
        ]
      },
      {
        number: 6,
        title: 'Save Changes',
        description: 'Click "Save" to apply DNS changes',
        details: ['DNS changes typically propagate within 15-60 minutes']
      }
    ],
    dnsSettingsUrl: 'https://www.dynadot.com/community/help/question/dns-management',
    supportUrl: 'https://www.dynadot.com/community/help'
  },
  names: {
    name: 'Name.com (Names.co.uk)',
    icon: '🇬🇧',
    steps: [
      {
        number: 1,
        title: 'Log in to Names.co.uk',
        description: 'Go to names.co.uk and log in to your account',
        details: []
      },
      {
        number: 2,
        title: 'Access Domain Control',
        description: 'Click on "Domain Control" or your domain',
        details: []
      },
      {
        number: 3,
        title: 'Go to DNS Management',
        description: 'Click on "DNS Management" or "DNS Records"',
        details: []
      },
      {
        number: 4,
        title: 'Add A Record',
        description: 'Click "Add Record" and configure:',
        details: [
          'Host: @',
          'Type: A',
          'Value: [ICP IPv4 Address]',
          'TTL: 3600'
        ]
      },
      {
        number: 5,
        title: 'Add AAAA Record',
        description: 'Click "Add Record" and configure:',
        details: [
          'Host: @',
          'Type: AAAA',
          'Value: [ICP IPv6 Address]',
          'TTL: 3600'
        ]
      },
      {
        number: 6,
        title: 'Save Changes',
        description: 'Click "Save" or "Update" to apply changes',
        details: ['DNS propagation typically takes 15-60 minutes']
      }
    ],
    dnsSettingsUrl: 'https://www.names.co.uk/',
    supportUrl: 'https://www.names.co.uk/support'
  }
};

export const getRegistrarInstruction = (registrarName: string): RegistrarInstruction | null => {
  const normalized = registrarName.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Map common variations
  const mapping: Record<string, string> = {
    'namesilo': 'namesilo',
    'namecheap': 'namecheap',
    'godaddy': 'godaddy',
    'cloudflare': 'cloudflare',
    'namecom': 'namecom',
    'name.com': 'namecom',
    'porkbun': 'porkbun',
    'googledomains': 'google',
    'hover': 'hover',
    'dynadot': 'dynadot',
    'namescouk': 'names',
    'names.co.uk': 'names'
  };
  
  const key = mapping[normalized] || normalized;
  return REGISTRAR_INSTRUCTIONS[key] || null;
};
