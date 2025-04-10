import { exec } from "child_process";
import { promisify } from "util";
import * as os from "os";
import { SecurityType, NetworkType, type WiFiNetwork } from "@/types";
import { logger } from "@/lib/logger";

// 将exec转换为Promise形式
const execAsync = promisify(exec);

// 平台类型定义
type Platform = "windows" | "macos" | "linux" | "unknown";

/**
 * WiFi平台适配器接口
 * 为不同平台提供统一的接口
 */
interface WifiPlatformAdapter {
  isAvailable(): Promise<boolean>;
  getAvailableNetworks(): Promise<WiFiNetwork[]>;
  getCurrentNetwork(): Promise<WiFiNetwork | null>;
  getSavedNetworks(): Promise<WiFiNetwork[]>;
  startScan(): Promise<boolean>;
  connectToNetwork(ssid: string, password?: string): Promise<boolean>;
  disconnectFromNetwork(): Promise<boolean>;
}

/**
 * Windows平台WiFi适配器
 * 使用netsh命令与Windows的WiFi功能交互
 */
class WindowsWifiAdapter implements WifiPlatformAdapter {
  async isAvailable(): Promise<boolean> {
    try {
      const { stdout } = await execAsync("netsh wlan show interfaces");
      return stdout.includes("GUID") || stdout.includes("Name");
    } catch (error) {
      logger.error("检查Windows WiFi接口失败:", error);
      return false;
    }
  }

  async getAvailableNetworks(): Promise<WiFiNetwork[]> {
    try {
      const { stdout } = await execAsync("netsh wlan show networks mode=bssid");
      return this.parseNetworkList(stdout);
    } catch (error) {
      logger.error("获取Windows可用WiFi网络失败:", error);
      throw new Error(
        `获取WiFi网络失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
    }
  }

  async getCurrentNetwork(): Promise<WiFiNetwork | null> {
    try {
      const { stdout } = await execAsync("netsh wlan show interfaces");
      return this.parseCurrentNetwork(stdout);
    } catch (error) {
      logger.error("获取Windows当前WiFi网络失败:", error);
      throw new Error(
        `获取当前网络失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
    }
  }

  async getSavedNetworks(): Promise<WiFiNetwork[]> {
    try {
      const { stdout } = await execAsync("netsh wlan show profiles");
      return this.parseProfilesList(stdout);
    } catch (error) {
      logger.error("获取Windows保存的WiFi网络失败:", error);
      throw new Error(
        `获取保存的网络失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
    }
  }

  async startScan(): Promise<boolean> {
    try {
      await execAsync("netsh wlan scan");
      return true;
    } catch (error) {
      logger.error("启动Windows WiFi扫描失败:", error);
      return false;
    }
  }

  async connectToNetwork(ssid: string, password?: string): Promise<boolean> {
    try {
      let command = "";

      if (password) {
        // 在Windows中创建临时配置文件连接需要复杂操作
        // 此处简化操作，仅支持已保存的网络连接
        logger.warn(
          "Windows平台暂不支持带密码的直接连接，请先添加网络配置文件"
        );
        return false;
      } else {
        // 连接到已保存的网络
        command = `netsh wlan connect name="${ssid}"`;
      }

      await execAsync(command);
      return true;
    } catch (error) {
      logger.error(`连接到Windows WiFi网络失败: ${ssid}`, error);
      return false;
    }
  }

  async disconnectFromNetwork(): Promise<boolean> {
    try {
      await execAsync("netsh wlan disconnect");
      return true;
    } catch (error) {
      logger.error("断开Windows WiFi连接失败:", error);
      return false;
    }
  }

  private parseNetworkList(output: string): WiFiNetwork[] {
    const networks: WiFiNetwork[] = [];
    const sections = output.split("SSID ");

    // 跳过第一个部分（通常是命令头部信息）
    for (let i = 1; i < sections.length; i++) {
      try {
        const section = sections[i];

        // 提取SSID
        const ssidMatch = section.match(/^\d+\s*:\s*(.*)/);
        if (!ssidMatch) continue;

        const ssid = ssidMatch[1].trim();

        // 提取安全类型
        let security = SecurityType.OPEN;
        if (section.includes("WPA2")) {
          security = SecurityType.WPA2;
        } else if (section.includes("WPA3")) {
          security = SecurityType.WPA3;
        } else if (section.includes("WPA")) {
          security = SecurityType.WPA;
        } else if (section.includes("WEP")) {
          security = SecurityType.WEP;
        }

        // 提取信号强度
        const signalMatch =
          section.match(/信号\s*:\s*(\d+)%/) ||
          section.match(/Signal\s*:\s*(\d+)%/);
        const signalStrength = signalMatch ? parseInt(signalMatch[1], 10) : 0;

        // 提取BSSID (MAC地址)
        const bssidMatch = section.match(/BSSID\s*\d*\s*:\s*([0-9A-Fa-f:]+)/);
        const bssid = bssidMatch
          ? bssidMatch[1].trim()
          : `unknown_${Date.now()}_${i}`;

        networks.push({
          ssid,
          bssid,
          security,
          signalStrength,
          type: NetworkType.WIFI,
          saved: false, // 将在后续与保存的网络列表比较后更新
          settings: {
            autoConnect: false,
            redirectUrl: null,
            hidden: false,
            priority: 0,
            redirectTimeout: 3000,
          },
        });
      } catch (error) {
        logger.error(
          `解析网络信息失败: ${
            error instanceof Error ? error.message : "未知错误"
          }`
        );
        // 继续处理下一个网络
      }
    }

    return networks;
  }

  private parseCurrentNetwork(output: string): WiFiNetwork | null {
    try {
      // 提取SSID
      const ssidMatch = output.match(/SSID\s*:\s*(.*?)(\r|\n)/);
      if (!ssidMatch) return null;

      const ssid = ssidMatch[1].trim();

      // 提取BSSID
      const bssidMatch = output.match(/BSSID\s*:\s*([0-9A-Fa-f:]+)/);
      const bssid = bssidMatch ? bssidMatch[1].trim() : `current_${Date.now()}`;

      // 提取信号强度
      const signalMatch =
        output.match(/信号\s*:\s*(\d+)%/) ||
        output.match(/Signal\s*:\s*(\d+)%/);
      const signalStrength = signalMatch ? parseInt(signalMatch[1], 10) : 50; // 默认值50%

      // 提取安全类型（接口信息中可能没有，需要结合其他命令）
      // 这里简化处理，假设为WPA2
      const security = SecurityType.WPA2;

      return {
        ssid,
        bssid,
        security,
        signalStrength,
        type: NetworkType.WIFI,
        saved: true, // 已连接的网络通常是保存的网络
        settings: {
          autoConnect: true,
          redirectUrl: null,
          hidden: false,
          priority: 1,
          redirectTimeout: 3000,
        },
      };
    } catch (error) {
      logger.error(
        `解析当前网络信息失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
      return null;
    }
  }

  private async parseProfilesList(output: string): Promise<WiFiNetwork[]> {
    const networks: WiFiNetwork[] = [];
    const regex = /: (.*?)(\r|\n|$)/g;
    let match;

    const profileNames: string[] = [];

    try {
      // 提取所有配置文件名称
      while ((match = regex.exec(output)) !== null) {
        const profileName = match[1].trim();
        if (profileName && !profileName.startsWith("-")) {
          profileNames.push(profileName);
        }
      }
    } catch (error) {
      logger.error(
        `解析网络配置列表失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
    }

    // 对每个配置文件获取详细信息
    for (const profileName of profileNames) {
      try {
        const { stdout } = await execAsync(
          `netsh wlan show profile name="${profileName}" key=clear`
        );

        // 提取安全类型
        let security = SecurityType.OPEN;
        if (stdout.includes("WPA2")) {
          security = SecurityType.WPA2;
        } else if (stdout.includes("WPA3")) {
          security = SecurityType.WPA3;
        } else if (stdout.includes("WPA")) {
          security = SecurityType.WPA;
        } else if (stdout.includes("WEP")) {
          security = SecurityType.WEP;
        }

        networks.push({
          ssid: profileName,
          bssid: `saved_${profileName.replace(/\s+/g, "_")}_${Date.now()}`,
          security,
          signalStrength: 0, // 保存的网络可能不在范围内，信号为0
          type: NetworkType.WIFI,
          saved: true,
          settings: {
            autoConnect: true,
            redirectUrl: null,
            hidden: false,
            priority: 0,
            redirectTimeout: 3000,
          },
        });
      } catch (error) {
        logger.error(`获取网络配置详情失败: ${profileName}`, error);
      }
    }

    return networks;
  }
}

/**
 * macOS平台WiFi适配器
 * 使用airport和networksetup命令与macOS的WiFi功能交互
 */
class MacOSWifiAdapter implements WifiPlatformAdapter {
  private readonly airportCmd =
    "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport";

  async isAvailable(): Promise<boolean> {
    try {
      // 检查airport命令是否存在
      await execAsync(`ls ${this.airportCmd}`);
      return true;
    } catch (error) {
      try {
        // 尝试使用networksetup命令
        const { stdout } = await execAsync(
          "networksetup -listallhardwareports"
        );
        return stdout.includes("Wi-Fi") || stdout.includes("AirPort");
      } catch (e) {
        logger.error("检查macOS WiFi接口失败:", e);
        return false;
      }
    }
  }

  async getAvailableNetworks(): Promise<WiFiNetwork[]> {
    try {
      // 使用airport命令扫描WiFi网络
      const { stdout } = await execAsync(`${this.airportCmd} -s`);
      return this.parseNetworkList(stdout);
    } catch (error) {
      logger.error("获取macOS可用WiFi网络失败:", error);

      try {
        // 尝试使用备用方法
        const { stdout } = await execAsync(
          "networksetup -listallhardwareports"
        );
        const wifiDevice = this.extractWifiDevice(stdout);

        if (wifiDevice) {
          const { stdout } = await execAsync(
            `networksetup -listpreferredwirelessnetworks ${wifiDevice}`
          );
          return this.parseNetworkSetupList(stdout);
        }
        throw new Error("无法找到WiFi设备");
      } catch (backupError) {
        logger.error("备用WiFi列表获取也失败:", backupError);
        throw new Error(
          `获取WiFi网络失败: ${
            error instanceof Error ? error.message : "未知错误"
          }`
        );
      }
    }
  }

  async getCurrentNetwork(): Promise<WiFiNetwork | null> {
    try {
      // 使用airport命令获取当前WiFi信息
      const { stdout } = await execAsync(`${this.airportCmd} -I`);
      return this.parseCurrentNetwork(stdout);
    } catch (error) {
      logger.error("获取macOS当前WiFi网络失败:", error);

      try {
        // 尝试使用备用方法
        const { stdout } = await execAsync(
          "networksetup -listallhardwareports"
        );
        const wifiDevice = this.extractWifiDevice(stdout);

        if (wifiDevice) {
          const { stdout } = await execAsync(
            `networksetup -getairportnetwork ${wifiDevice}`
          );
          return this.parseCurrentNetworkFromNetworkSetup(stdout, wifiDevice);
        }
        return null;
      } catch (backupError) {
        logger.error("备用当前网络获取也失败:", backupError);
        return null;
      }
    }
  }

  async getSavedNetworks(): Promise<WiFiNetwork[]> {
    try {
      // 获取WiFi设备名称
      const { stdout: portsOutput } = await execAsync(
        "networksetup -listallhardwareports"
      );
      const wifiDevice = this.extractWifiDevice(portsOutput);

      if (!wifiDevice) {
        throw new Error("无法确定WiFi设备名称");
      }

      // 获取保存的WiFi网络列表
      const { stdout } = await execAsync(
        `networksetup -listpreferredwirelessnetworks ${wifiDevice}`
      );
      return this.parsePreferredNetworks(stdout);
    } catch (error) {
      logger.error("获取macOS保存的WiFi网络失败:", error);
      throw new Error(
        `获取保存的网络失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
    }
  }

  async startScan(): Promise<boolean> {
    try {
      await execAsync(`${this.airportCmd} -s`);
      return true;
    } catch (error) {
      logger.error("启动macOS WiFi扫描失败:", error);
      return false;
    }
  }

  async connectToNetwork(ssid: string, password?: string): Promise<boolean> {
    try {
      // 获取WiFi设备名称
      const { stdout: portsOutput } = await execAsync(
        "networksetup -listallhardwareports"
      );
      const wifiDevice = this.extractWifiDevice(portsOutput);

      if (!wifiDevice) {
        throw new Error("无法确定WiFi设备名称");
      }

      // 构建连接命令
      let command = "";
      if (password) {
        command = `networksetup -setairportnetwork ${wifiDevice} "${ssid}" "${password}"`;
      } else {
        command = `networksetup -setairportnetwork ${wifiDevice} "${ssid}"`;
      }

      await execAsync(command);
      return true;
    } catch (error) {
      logger.error(`连接到macOS WiFi网络失败: ${ssid}`, error);
      return false;
    }
  }

  async disconnectFromNetwork(): Promise<boolean> {
    try {
      // 关闭WiFi连接
      await execAsync("networksetup -setairportpower en0 off");
      // 稍后再打开以断开当前连接
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await execAsync("networksetup -setairportpower en0 on");
      return true;
    } catch (error) {
      logger.error("断开macOS WiFi连接失败:", error);
      return false;
    }
  }

  private parseNetworkList(output: string): WiFiNetwork[] {
    const networks: WiFiNetwork[] = [];
    const lines = output.split("\n");

    // 跳过标题行
    for (let i = 1; i < lines.length; i++) {
      try {
        const line = lines[i].trim();
        if (!line) continue;

        // airport -s 的输出格式比较复杂，需要根据空格分割
        const parts = line.split(/\s+/);
        if (parts.length < 5) continue;

        const ssid = parts[0];
        const bssid = parts[1];
        // 信号强度通常是RSSI值，需要转换为百分比
        // macOS的RSSI通常是-30(很好) 到 -90(很差)之间的值
        const rssi = parseInt(parts[2], 10);
        const signalStrength = this.convertRSSIToPercentage(rssi);

        // 解析安全类型
        let security = SecurityType.OPEN;
        const securityInfo = line.substring(
          line.lastIndexOf(parts[parts.length - 2])
        );
        if (securityInfo.includes("WPA2")) {
          security = SecurityType.WPA2;
        } else if (securityInfo.includes("WPA3")) {
          security = SecurityType.WPA3;
        } else if (securityInfo.includes("WPA")) {
          security = SecurityType.WPA;
        } else if (securityInfo.includes("WEP")) {
          security = SecurityType.WEP;
        }

        networks.push({
          ssid,
          bssid,
          security,
          signalStrength,
          type: NetworkType.WIFI,
          saved: false, // 将在后续与保存的网络列表比较后更新
          settings: {
            autoConnect: false,
            redirectUrl: null,
            hidden: false,
            priority: 0,
            redirectTimeout: 3000,
          },
        });
      } catch (error) {
        logger.error(
          `解析macOS网络信息失败: ${
            error instanceof Error ? error.message : "未知错误"
          }`
        );
        // 继续处理下一个网络
      }
    }

    return networks;
  }

  private parseCurrentNetwork(output: string): WiFiNetwork | null {
    try {
      const lines = output.split("\n");
      let ssid = "";
      let bssid = "";
      let rssi = -50; // 默认中等信号

      for (const line of lines) {
        if (line.includes("SSID:")) {
          ssid = line.split(":")[1].trim();
        } else if (line.includes("BSSID:")) {
          bssid = line.split(":")[1].trim();
        } else if (line.includes("agrCtlRSSI:")) {
          rssi = parseInt(line.split(":")[1].trim(), 10);
        }
      }

      if (!ssid) return null;

      // RSSI转换为信号强度百分比
      const signalStrength = this.convertRSSIToPercentage(rssi);

      return {
        ssid,
        bssid: bssid || `current_${Date.now()}`,
        security: SecurityType.WPA2, // 假设为WPA2
        signalStrength,
        type: NetworkType.WIFI,
        saved: true,
        settings: {
          autoConnect: true,
          redirectUrl: null,
          hidden: false,
          priority: 1,
          redirectTimeout: 3000,
        },
      };
    } catch (error) {
      logger.error(
        `解析macOS当前网络信息失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
      return null;
    }
  }

  private parsePreferredNetworks(output: string): WiFiNetwork[] {
    const networks: WiFiNetwork[] = [];
    const lines = output.split("\n");

    // 从输出中提取网络名称列表
    let startParsing = false;
    for (const line of lines) {
      try {
        if (!startParsing) {
          if (line.includes("Preferred networks")) {
            startParsing = true;
          }
          continue;
        }

        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith("--")) {
          networks.push({
            ssid: trimmedLine,
            bssid: `saved_${trimmedLine.replace(/\s+/g, "_")}_${Date.now()}`,
            security: SecurityType.UNKNOWN, // 无法从列表中确定安全类型
            signalStrength: 0, // 保存的网络可能不在范围内，信号为0
            type: NetworkType.WIFI,
            saved: true,
            settings: {
              autoConnect: true,
              redirectUrl: null,
              hidden: false,
              priority: 0,
              redirectTimeout: 3000,
            },
          });
        }
      } catch (error) {
        logger.error(
          `解析macOS保存网络信息失败: ${
            error instanceof Error ? error.message : "未知错误"
          }`
        );
        // 继续处理下一个网络
      }
    }

    return networks;
  }

  private extractWifiDevice(output: string): string | null {
    const lines = output.split("\n");
    let nextLineIsDevice = false;

    for (const line of lines) {
      if (nextLineIsDevice) {
        const match = line.match(/Device:\s*(\w+)/);
        if (match) {
          return match[1];
        }
        nextLineIsDevice = false;
      }

      if (line.includes("Wi-Fi") || line.includes("AirPort")) {
        nextLineIsDevice = true;
      }
    }

    return null;
  }

  private parseNetworkSetupList(output: string): WiFiNetwork[] {
    // 简化实现，仅返回网络名称列表
    return this.parsePreferredNetworks(output);
  }

  private parseCurrentNetworkFromNetworkSetup(
    output: string,
    device: string
  ): WiFiNetwork | null {
    try {
      // 格式通常是: "Current Wi-Fi Network: SSID_NAME"
      const match = output.match(
        /Current\s+(?:Wi-Fi|AirPort)\s+Network:\s+(.+)/i
      );
      if (!match) return null;

      const ssid = match[1].trim();

      return {
        ssid,
        bssid: `current_${Date.now()}`,
        security: SecurityType.WPA2, // 假设为WPA2
        signalStrength: 50, // 默认50%
        type: NetworkType.WIFI,
        saved: true,
        settings: {
          autoConnect: true,
          redirectUrl: null,
          hidden: false,
          priority: 1,
          redirectTimeout: 3000,
        },
      };
    } catch (error) {
      logger.error(
        `解析macOS当前网络信息失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
      return null;
    }
  }

  // 将RSSI值转换为百分比信号强度
  // macOS的RSSI通常是-30(很好) 到 -90(很差)之间的值
  private convertRSSIToPercentage(rssi: number): number {
    if (rssi >= -50) return 100; // 极佳信号
    if (rssi >= -60) return 80; // 非常好
    if (rssi >= -70) return 60; // 好
    if (rssi >= -80) return 40; // 一般
    if (rssi >= -90) return 20; // 较弱
    return 10; // 非常弱
  }
}

/**
 * Linux平台WiFi适配器
 * 优先使用NetworkManager的nmcli命令，如果不可用则使用iwconfig
 */
class LinuxWifiAdapter implements WifiPlatformAdapter {
  // 判断使用nmcli还是iwconfig
  private useNmcli = true;

  async isAvailable(): Promise<boolean> {
    try {
      // 尝试检测nmcli是否可用
      await execAsync("which nmcli");
      this.useNmcli = true;
      return true;
    } catch (error) {
      try {
        // 尝试检测iwconfig是否可用
        await execAsync("which iwconfig");
        this.useNmcli = false;
        return true;
      } catch (e) {
        logger.error("检查Linux WiFi接口失败: 未找到nmcli或iwconfig", e);
        return false;
      }
    }
  }

  async getAvailableNetworks(): Promise<WiFiNetwork[]> {
    try {
      if (this.useNmcli) {
        // 使用nmcli命令获取WiFi列表
        const { stdout } = await execAsync(
          "nmcli -t -f SSID,BSSID,SIGNAL,SECURITY device wifi list"
        );
        return this.parseNmcliNetworkList(stdout);
      } else {
        // 使用iwlist命令获取WiFi列表
        const { stdout: interfaceOutput } = await execAsync(
          'iwconfig 2>/dev/null | grep -o "^[a-z0-9]*"'
        );
        const wirelessInterfaces = interfaceOutput
          .trim()
          .split("\n")
          .filter(Boolean);

        if (wirelessInterfaces.length === 0) {
          throw new Error("未找到无线网卡");
        }

        // 使用第一个无线接口
        const { stdout } = await execAsync(
          `iwlist ${wirelessInterfaces[0]} scan`
        );
        return this.parseIwlistNetworkList(stdout);
      }
    } catch (error) {
      logger.error("获取Linux可用WiFi网络失败:", error);
      throw new Error(
        `获取WiFi网络失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
    }
  }

  async getCurrentNetwork(): Promise<WiFiNetwork | null> {
    try {
      if (this.useNmcli) {
        // 使用nmcli命令获取当前连接的WiFi
        const { stdout } = await execAsync(
          "nmcli -t -f NAME,DEVICE connection show --active"
        );
        const connections = stdout.trim().split("\n");

        for (const conn of connections) {
          const [name, device] = conn.split(":");
          // 检查是否为WiFi设备
          const { stdout: deviceType } = await execAsync(
            `nmcli -t -f TYPE device show ${device}`
          );
          if (deviceType.includes("wifi")) {
            // 获取详细信息
            const { stdout: details } = await execAsync(
              `nmcli -t -f GENERAL.CONNECTION,ACTIVE,SIGNAL connection show "${name}"`
            );
            return this.parseNmcliCurrentNetwork(details, name);
          }
        }

        return null;
      } else {
        // 使用iwconfig命令获取当前连接的WiFi
        const { stdout } = await execAsync("iwconfig 2>/dev/null");
        return this.parseIwconfigCurrentNetwork(stdout);
      }
    } catch (error) {
      logger.error("获取Linux当前WiFi网络失败:", error);
      return null;
    }
  }

  async getSavedNetworks(): Promise<WiFiNetwork[]> {
    try {
      if (this.useNmcli) {
        // 使用nmcli命令获取已保存的WiFi连接
        const { stdout } = await execAsync(
          "nmcli -t -f NAME,TYPE,AUTOCONNECT connection show"
        );
        return this.parseNmcliSavedNetworks(stdout);
      } else {
        // 使用wpa_cli命令获取已保存的WiFi连接
        try {
          const { stdout } = await execAsync("wpa_cli list_networks");
          return this.parseWpacliSavedNetworks(stdout);
        } catch (error) {
          logger.error("使用wpa_cli获取保存的WiFi网络失败:", error);
          // 如果wpa_cli不可用，尝试读取wpa_supplicant.conf
          const { stdout } = await execAsync(
            "cat /etc/wpa_supplicant/wpa_supplicant.conf 2>/dev/null || cat /etc/wpa_supplicant.conf 2>/dev/null"
          );
          return this.parseWpaSupplicantConf(stdout);
        }
      }
    } catch (error) {
      logger.error("获取Linux保存的WiFi网络失败:", error);
      throw new Error(
        `获取保存的网络失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
    }
  }

  async startScan(): Promise<boolean> {
    try {
      if (this.useNmcli) {
        // 使用nmcli命令扫描WiFi
        await execAsync("nmcli device wifi rescan");
      } else {
        // 使用iwlist命令扫描WiFi
        const { stdout: interfaceOutput } = await execAsync(
          'iwconfig 2>/dev/null | grep -o "^[a-z0-9]*"'
        );
        const wirelessInterfaces = interfaceOutput
          .trim()
          .split("\n")
          .filter(Boolean);

        if (wirelessInterfaces.length === 0) {
          throw new Error("未找到无线网卡");
        }

        // 使用第一个无线接口
        await execAsync(`iwlist ${wirelessInterfaces[0]} scan`);
      }
      return true;
    } catch (error) {
      logger.error("启动Linux WiFi扫描失败:", error);
      return false;
    }
  }

  async connectToNetwork(ssid: string, password?: string): Promise<boolean> {
    try {
      if (this.useNmcli) {
        // 检查连接是否已经存在
        const { stdout: connCheck } = await execAsync(
          `nmcli -t connection show | grep "${ssid}"`
        );

        if (connCheck) {
          // 连接已存在，直接激活
          await execAsync(`nmcli connection up "${ssid}"`);
        } else {
          // 创建新连接
          if (password) {
            await execAsync(
              `nmcli device wifi connect "${ssid}" password "${password}"`
            );
          } else {
            await execAsync(`nmcli device wifi connect "${ssid}"`);
          }
        }
      } else {
        // 使用wpa_cli连接
        // 注意：此处简化处理，实际应用中可能需要更复杂的逻辑
        if (!password) {
          logger.warn("Linux iwconfig模式需要提供密码来连接新网络");
          return false;
        }

        // 获取无线接口名称
        const { stdout: interfaceOutput } = await execAsync(
          'iwconfig 2>/dev/null | grep -o "^[a-z0-9]*"'
        );
        const wirelessInterfaces = interfaceOutput
          .trim()
          .split("\n")
          .filter(Boolean);

        if (wirelessInterfaces.length === 0) {
          throw new Error("未找到无线网卡");
        }

        const interface = wirelessInterfaces[0];

        // 创建临时wpa_supplicant配置文件
        const tempConfPath = "/tmp/wpa_supplicant_temp.conf";
        await execAsync(`echo "network={
          ssid=\\"${ssid}\\"
          psk=\\"${password}\\"
        }" > ${tempConfPath}`);

        // 连接网络
        await execAsync(
          `wpa_supplicant -B -i ${interface} -c ${tempConfPath} && dhclient ${interface}`
        );

        // 删除临时文件
        await execAsync(`rm ${tempConfPath}`);
      }
      return true;
    } catch (error) {
      logger.error(`连接到Linux WiFi网络失败: ${ssid}`, error);
      return false;
    }
  }

  async disconnectFromNetwork(): Promise<boolean> {
    try {
      if (this.useNmcli) {
        // 获取当前活动的WiFi连接
        const { stdout } = await execAsync(
          "nmcli -t -f NAME,DEVICE,TYPE connection show --active"
        );
        const connections = stdout.trim().split("\n");

        for (const conn of connections) {
          const [name, device, type] = conn.split(":");
          if (type === "wifi" || type === "802-11-wireless") {
            // 断开连接
            await execAsync(`nmcli connection down "${name}"`);
            return true;
          }
        }

        logger.warn("未找到活动的WiFi连接");
        return false;
      } else {
        // 使用iwconfig断开连接
        const { stdout: interfaceOutput } = await execAsync(
          'iwconfig 2>/dev/null | grep -o "^[a-z0-9]*"'
        );
        const wirelessInterfaces = interfaceOutput
          .trim()
          .split("\n")
          .filter(Boolean);

        if (wirelessInterfaces.length === 0) {
          throw new Error("未找到无线网卡");
        }

        // 断开所有无线接口
        for (const interface of wirelessInterfaces) {
          await execAsync(`ifconfig ${interface} down`);
        }

        return true;
      }
    } catch (error) {
      logger.error("断开Linux WiFi连接失败:", error);
      return false;
    }
  }

  private parseNmcliNetworkList(output: string): WiFiNetwork[] {
    const networks: WiFiNetwork[] = [];
    const lines = output.trim().split("\n");

    for (const line of lines) {
      try {
        const [ssid, bssid, signal, securityStr] = line.split(":");

        // 解析安全类型
        let security = SecurityType.OPEN;
        if (securityStr) {
          if (securityStr.includes("WPA2")) {
            security = SecurityType.WPA2;
          } else if (securityStr.includes("WPA3")) {
            security = SecurityType.WPA3;
          } else if (securityStr.includes("WPA")) {
            security = SecurityType.WPA;
          } else if (securityStr.includes("WEP")) {
            security = SecurityType.WEP;
          }
        }

        // 信号强度通常是百分比
        const signalStrength = parseInt(signal, 10) || 0;

        networks.push({
          ssid: ssid || "Unknown",
          bssid: bssid || `unknown_${Date.now()}_${networks.length}`,
          security,
          signalStrength,
          type: NetworkType.WIFI,
          saved: false,
          settings: {
            autoConnect: false,
            redirectUrl: null,
            hidden: false,
            priority: 0,
            redirectTimeout: 3000,
          },
        });
      } catch (error) {
        logger.error(
          `解析nmcli网络信息失败: ${
            error instanceof Error ? error.message : "未知错误"
          }`
        );
        // 继续处理下一个网络
      }
    }

    return networks;
  }

  private parseIwlistNetworkList(output: string): WiFiNetwork[] {
    const networks: WiFiNetwork[] = [];
    const cells = output.split("Cell ").slice(1); // 跳过第一个部分

    for (const cell of cells) {
      try {
        let ssid = "";
        let bssid = "";
        let signalStrength = 0;
        let security = SecurityType.OPEN;

        // 提取SSID
        const ssidMatch = cell.match(/ESSID:"(.+?)"/);
        if (ssidMatch) {
          ssid = ssidMatch[1];
        }

        // 提取BSSID
        const bssidMatch = cell.match(/Address:\s*([0-9A-Fa-f:]+)/);
        if (bssidMatch) {
          bssid = bssidMatch[1];
        }

        // 提取信号强度
        const signalMatch =
          cell.match(/Signal level=(-\d+) dBm/) ||
          cell.match(/Quality=(\d+)\/70/);
        if (signalMatch) {
          // 如果是dBm值(-30到-90)
          if (signalMatch[1].startsWith("-")) {
            const dBm = parseInt(signalMatch[1], 10);
            signalStrength = this.convertDBMToPercentage(dBm);
          } else {
            // 如果是Quality值(0到70)
            const quality = parseInt(signalMatch[1], 10);
            signalStrength = Math.min(100, Math.round((quality / 70) * 100));
          }
        }

        // 提取安全类型
        if (cell.includes("WPA2")) {
          security = SecurityType.WPA2;
        } else if (cell.includes("WPA3")) {
          security = SecurityType.WPA3;
        } else if (cell.includes("WPA")) {
          security = SecurityType.WPA;
        } else if (cell.includes("WEP")) {
          security = SecurityType.WEP;
        }

        if (ssid) {
          networks.push({
            ssid,
            bssid: bssid || `unknown_${Date.now()}_${networks.length}`,
            security,
            signalStrength,
            type: NetworkType.WIFI,
            saved: false,
            settings: {
              autoConnect: false,
              redirectUrl: null,
              hidden: false,
              priority: 0,
              redirectTimeout: 3000,
            },
          });
        }
      } catch (error) {
        logger.error(
          `解析iwlist网络信息失败: ${
            error instanceof Error ? error.message : "未知错误"
          }`
        );
        // 继续处理下一个网络
      }
    }

    return networks;
  }

  private parseNmcliCurrentNetwork(
    output: string,
    name: string
  ): WiFiNetwork | null {
    try {
      let signalStrength = 50; // 默认值
      const lines = output.trim().split("\n");

      for (const line of lines) {
        if (line.startsWith("SIGNAL:")) {
          signalStrength = parseInt(line.split(":")[1], 10);
          break;
        }
      }

      return {
        ssid: name,
        bssid: `current_${Date.now()}`,
        security: SecurityType.WPA2, // 默认假设
        signalStrength,
        type: NetworkType.WIFI,
        saved: true,
        settings: {
          autoConnect: true,
          redirectUrl: null,
          hidden: false,
          priority: 1,
          redirectTimeout: 3000,
        },
      };
    } catch (error) {
      logger.error(
        `解析nmcli当前网络信息失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
      return null;
    }
  }

  private parseIwconfigCurrentNetwork(output: string): WiFiNetwork | null {
    try {
      // 提取SSID
      const ssidMatch = output.match(/ESSID:"(.+?)"/);
      if (!ssidMatch) return null;

      const ssid = ssidMatch[1];

      // 提取BSSID/AP
      const bssidMatch = output.match(/Access Point:\s*([0-9A-Fa-f:]+)/);
      const bssid = bssidMatch ? bssidMatch[1] : `current_${Date.now()}`;

      // 提取信号强度
      let signalStrength = 50; // 默认值
      const signalMatch =
        output.match(/Signal level=(-\d+) dBm/) ||
        output.match(/Signal level=(\d+)\/100/);
      if (signalMatch) {
        if (signalMatch[1].startsWith("-")) {
          // dBm值转换为百分比
          const dBm = parseInt(signalMatch[1], 10);
          signalStrength = this.convertDBMToPercentage(dBm);
        } else {
          // 直接使用百分比
          signalStrength = parseInt(signalMatch[1], 10);
        }
      }

      return {
        ssid,
        bssid,
        security: SecurityType.WPA2, // 默认假设
        signalStrength,
        type: NetworkType.WIFI,
        saved: true,
        settings: {
          autoConnect: true,
          redirectUrl: null,
          hidden: false,
          priority: 1,
          redirectTimeout: 3000,
        },
      };
    } catch (error) {
      logger.error(
        `解析iwconfig当前网络信息失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
      return null;
    }
  }

  private parseNmcliSavedNetworks(output: string): WiFiNetwork[] {
    const networks: WiFiNetwork[] = [];
    const lines = output.trim().split("\n");

    for (const line of lines) {
      try {
        const [name, type, autoconnect] = line.split(":");

        // 只处理WiFi类型的连接
        if (type === "wifi" || type === "802-11-wireless") {
          networks.push({
            ssid: name,
            bssid: `saved_${name.replace(/\s+/g, "_")}_${Date.now()}`,
            security: SecurityType.UNKNOWN, // 无法确定保存连接的安全类型
            signalStrength: 0,
            type: NetworkType.WIFI,
            saved: true,
            settings: {
              autoConnect: autoconnect === "yes",
              redirectUrl: null,
              hidden: false,
              priority: 0,
              redirectTimeout: 3000,
            },
          });
        }
      } catch (error) {
        logger.error(
          `解析nmcli保存网络信息失败: ${
            error instanceof Error ? error.message : "未知错误"
          }`
        );
        // 继续处理下一个网络
      }
    }

    return networks;
  }

  private parseWpacliSavedNetworks(output: string): WiFiNetwork[] {
    const networks: WiFiNetwork[] = [];
    const lines = output.trim().split("\n");

    // 跳过标题行
    for (let i = 1; i < lines.length; i++) {
      try {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split("\t");
        if (parts.length >= 2) {
          const ssid = parts[1];
          networks.push({
            ssid,
            bssid: `saved_${ssid.replace(/\s+/g, "_")}_${Date.now()}`,
            security: SecurityType.UNKNOWN,
            signalStrength: 0,
            type: NetworkType.WIFI,
            saved: true,
            settings: {
              autoConnect: true,
              redirectUrl: null,
              hidden: false,
              priority: 0,
              redirectTimeout: 3000,
            },
          });
        }
      } catch (error) {
        logger.error(
          `解析wpa_cli保存网络信息失败: ${
            error instanceof Error ? error.message : "未知错误"
          }`
        );
        // 继续处理下一个网络
      }
    }

    return networks;
  }

  private parseWpaSupplicantConf(output: string): WiFiNetwork[] {
    const networks: WiFiNetwork[] = [];

    // 查找所有网络配置块
    const networkBlocks = output.match(/network=\{[^}]+\}/g);

    if (!networkBlocks) return networks;

    for (const block of networkBlocks) {
      try {
        // 提取SSID
        const ssidMatch = block.match(/ssid="([^"]+)"/);
        if (!ssidMatch) continue;

        const ssid = ssidMatch[1];

        // 检查安全类型
        let security = SecurityType.OPEN;
        if (block.includes("psk=")) {
          security = SecurityType.WPA2;
        } else if (block.includes("wep_key")) {
          security = SecurityType.WEP;
        }

        networks.push({
          ssid,
          bssid: `saved_${ssid.replace(/\s+/g, "_")}_${Date.now()}`,
          security,
          signalStrength: 0,
          type: NetworkType.WIFI,
          saved: true,
          settings: {
            autoConnect: true,
            redirectUrl: null,
            hidden: block.includes("scan_ssid=1"),
            priority: 0,
            redirectTimeout: 3000,
          },
        });
      } catch (error) {
        logger.error(
          `解析wpa_supplicant配置失败: ${
            error instanceof Error ? error.message : "未知错误"
          }`
        );
        // 继续处理下一个网络
      }
    }

    return networks;
  }

  // 将dBm值转换为信号强度百分比
  private convertDBMToPercentage(dBm: number): number {
    // 通常dBm值范围从-30(极好)到-90(极差)
    if (dBm >= -50) return 100;
    if (dBm >= -60) return 80;
    if (dBm >= -70) return 60;
    if (dBm >= -80) return 40;
    if (dBm >= -90) return 20;
    return 10;
  }
}

/**
 * 系统WiFi服务
 * 根据平台选择适当的适配器实现
 */
export class SystemWifiService {
  private adapter: WifiPlatformAdapter | null = null;
  private platform: Platform = "unknown";

  constructor() {
    this.detectPlatform();
  }

  /**
   * 检测当前平台并初始化适当的适配器
   */
  private detectPlatform() {
    const platform = os.platform();

    if (platform === "win32") {
      this.platform = "windows";
      this.adapter = new WindowsWifiAdapter();
    } else if (platform === "darwin") {
      this.platform = "macos";
      this.adapter = new MacOSWifiAdapter();
    } else if (platform === "linux") {
      this.platform = "linux";
      this.adapter = new LinuxWifiAdapter();
    } else {
      this.platform = "unknown";
      this.adapter = null;
      logger.warn(`不支持的操作系统平台: ${platform}`);
    }

    logger.info(`平台检测: ${this.platform}`);
  }

  /**
   * 检查WiFi接口是否可用
   */
  async isWifiAvailable(): Promise<boolean> {
    try {
      if (!this.adapter) return false;

      return await this.adapter.isAvailable();
    } catch (error) {
      logger.error(`检查WiFi接口可用性失败 (${this.platform})`, error);
      return false;
    }
  }

  /**
   * 获取所有可用的WiFi网络
   */
  async getAvailableNetworks(): Promise<WiFiNetwork[]> {
    try {
      if (!this.adapter) {
        throw new Error(`不支持的平台: ${this.platform}`);
      }

      // 首先确认WiFi可用
      const isAvailable = await this.isWifiAvailable();
      if (!isAvailable) {
        logger.warn(`WiFi接口不可用 (${this.platform})`);
        return [];
      }

      return await this.adapter.getAvailableNetworks();
    } catch (error) {
      logger.error(`获取WiFi网络列表失败 (${this.platform})`, error);
      // 重新抛出异常，但包含更具体的错误信息
      throw new Error(
        `获取WiFi网络列表失败 (${this.platform}): ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
    }
  }

  /**
   * 获取当前连接的WiFi网络
   */
  async getCurrentNetwork(): Promise<WiFiNetwork | null> {
    try {
      if (!this.adapter) {
        logger.warn(`不支持的平台: ${this.platform}`);
        return null;
      }

      // 首先确认WiFi可用
      const isAvailable = await this.isWifiAvailable();
      if (!isAvailable) {
        logger.warn(`WiFi接口不可用 (${this.platform})`);
        return null;
      }

      return await this.adapter.getCurrentNetwork();
    } catch (error) {
      logger.error(`获取当前WiFi网络失败 (${this.platform})`, error);
      return null; // 发生错误时返回null而不是抛出异常
    }
  }

  /**
   * 获取所有保存的WiFi网络
   */
  async getSavedNetworks(): Promise<WiFiNetwork[]> {
    try {
      if (!this.adapter) {
        throw new Error(`不支持的平台: ${this.platform}`);
      }

      // 首先确认WiFi可用
      const isAvailable = await this.isWifiAvailable();
      if (!isAvailable) {
        logger.warn(`WiFi接口不可用 (${this.platform})`);
        return [];
      }

      return await this.adapter.getSavedNetworks();
    } catch (error) {
      logger.error(`获取保存的WiFi网络失败 (${this.platform})`, error);
      // 重新抛出异常，但包含更具体的错误信息
      throw new Error(
        `获取保存的WiFi网络失败 (${this.platform}): ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
    }
  }

  /**
   * 启动WiFi扫描
   */
  async startScan(): Promise<boolean> {
    try {
      if (!this.adapter) {
        logger.warn(`不支持的平台: ${this.platform}`);
        return false;
      }

      // 首先确认WiFi可用
      const isAvailable = await this.isWifiAvailable();
      if (!isAvailable) {
        logger.warn(`WiFi接口不可用 (${this.platform})`);
        return false;
      }

      return await this.adapter.startScan();
    } catch (error) {
      logger.error(`启动WiFi扫描失败 (${this.platform})`, error);
      return false; // 发生错误时返回false而不是抛出异常
    }
  }

  /**
   * 连接到WiFi网络
   */
  async connectToNetwork(ssid: string, password?: string): Promise<boolean> {
    try {
      if (!this.adapter) {
        logger.warn(`不支持的平台: ${this.platform}`);
        return false;
      }

      // 首先确认WiFi可用
      const isAvailable = await this.isWifiAvailable();
      if (!isAvailable) {
        logger.warn(`WiFi接口不可用 (${this.platform})`);
        return false;
      }

      return await this.adapter.connectToNetwork(ssid, password);
    } catch (error) {
      logger.error(`连接到WiFi网络失败 (${this.platform}): ${ssid}`, error);
      return false; // 发生错误时返回false而不是抛出异常
    }
  }

  /**
   * 断开当前WiFi连接
   */
  async disconnectFromNetwork(): Promise<boolean> {
    try {
      if (!this.adapter) {
        logger.warn(`不支持的平台: ${this.platform}`);
        return false;
      }

      // 首先确认WiFi可用
      const isAvailable = await this.isWifiAvailable();
      if (!isAvailable) {
        logger.warn(`WiFi接口不可用 (${this.platform})`);
        return false;
      }

      return await this.adapter.disconnectFromNetwork();
    } catch (error) {
      logger.error(`断开WiFi连接失败 (${this.platform})`, error);
      return false; // 发生错误时返回false而不是抛出异常
    }
  }

  /**
   * 获取当前平台信息
   */
  getPlatformInfo(): { platform: Platform; isSupported: boolean } {
    return {
      platform: this.platform,
      isSupported: this.adapter !== null,
    };
  }
}

// 创建单例实例
let systemWifiServiceInstance: SystemWifiService | null = null;

/**
 * 获取SystemWifiService实例
 */
export function getSystemWifiService(): SystemWifiService {
  if (!systemWifiServiceInstance) {
    systemWifiServiceInstance = new SystemWifiService();
  }
  return systemWifiServiceInstance;
}
