import os from 'os'

export interface NetworkIpInfo {
  name: string
  address: string
  isWifiOrEthernet: boolean
}

export function getAllLocalIpAddresses(): NetworkIpInfo[] {
  const interfaces = os.networkInterfaces()
  const ips: NetworkIpInfo[] = []

  // Virtual / VPN / Tunnel interface keywords to deprioritize
  const virtualKeywords = [
    'docker',
    'br-',
    'lxc',
    'veth',
    'vethernet',
    'vmnet',
    'vmware',
    'virtualbox',
    'vbox',
    'virbr',
    'hyper-v',
    'wsl',
    'loopback',
    'bluetooth',
    'tailscale',
    'zerotier',
    'wireguard',
    'npcap',
    'teredo',
    'isatap',
  ]

  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase()
    const isVirtual = virtualKeywords.some((keyword) => lowerName.includes(keyword))

    for (const net of interfaces[name] || []) {
      // Must be IPv4 and non-internal loopback
      if (net.family === 'IPv4' && !net.internal) {
        // Exclude APIPA / link-local addresses (169.254.x.x) which indicate unassigned or disconnected interface
        const isApipa = net.address.startsWith('169.254.')

        ips.push({
          name,
          address: net.address,
          isWifiOrEthernet: !isVirtual && !isApipa,
        })
      }
    }
  }

  // Scoring function:
  // 1. Physical interfaces in standard home / store Wi-Fi private ranges (192.168.x.x -> 100 pts)
  // 2. Class A private (10.x.x.x -> 90 pts)
  // 3. Class B private (172.16-31.x.x -> 80 pts)
  // 4. Other physical IPv4 -> 50 pts
  // 5. Virtual or APIPA -> 0 pts
  const getScore = (ip: NetworkIpInfo): number => {
    if (!ip.isWifiOrEthernet) return 0
    if (ip.address.startsWith('192.168.')) return 100
    if (ip.address.startsWith('10.')) return 90
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip.address)) return 80
    return 50
  }

  return ips.sort((a, b) => getScore(b) - getScore(a))
}

export function getLocalIpAddress(): string {
  const allIps = getAllLocalIpAddresses()
  // First prefer physical LAN interfaces (e.g. 192.168.1.84 or 10.0.0.5)
  const physicalIp = allIps.find((ip) => ip.isWifiOrEthernet)
  if (physicalIp) {
    return physicalIp.address
  }
  return allIps.length > 0 ? allIps[0].address : '127.0.0.1'
}
