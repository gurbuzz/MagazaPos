import os from 'os'

export interface NetworkIpInfo {
  name: string
  address: string
  isWifiOrEthernet: boolean
}

export function getAllLocalIpAddresses(): NetworkIpInfo[] {
  const interfaces = os.networkInterfaces()
  const ips: NetworkIpInfo[] = []

  // Virtual interface prefixes to deprioritize
  const virtualPrefixes = ['docker', 'br-', 'lxc', 'veth', 'vmnet', 'vbox', 'virbr']

  for (const name of Object.keys(interfaces)) {
    const isVirtual = virtualPrefixes.some((prefix) => name.toLowerCase().startsWith(prefix))

    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({
          name,
          address: net.address,
          isWifiOrEthernet: !isVirtual,
        })
      }
    }
  }

  // Sort real physical Wi-Fi / Ethernet interfaces first (e.g. 192.168.x.x or wlp/eth)
  return ips.sort((a, b) => (b.isWifiOrEthernet ? 1 : 0) - (a.isWifiOrEthernet ? 1 : 0))
}

export function getLocalIpAddress(): string {
  const allIps = getAllLocalIpAddresses()
  // First prefer physical interfaces like wlp4s0 or eth0 (e.g. 192.168.1.84)
  const physicalIp = allIps.find((ip) => ip.isWifiOrEthernet)
  if (physicalIp) {
    return physicalIp.address
  }
  return allIps.length > 0 ? allIps[0].address : '127.0.0.1'
}
