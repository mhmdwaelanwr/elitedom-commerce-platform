import facebook from "@/assets/social/facebook.svg";
import instagram from "@/assets/social/instagram.svg";
import tiktok from "@/assets/social/tiktok.svg";
import x from "@/assets/social/x.svg";
import youtube from "@/assets/social/youtube.svg";

const networks = [
  { label: "X", icon: x, href: "#" },
  { label: "Instagram", icon: instagram, href: "#" },
  { label: "Facebook", icon: facebook, href: "#" },
  { label: "YouTube", icon: youtube, href: "#" },
  { label: "TikTok", icon: tiktok, href: "#" },
] as const;

export function SocialDock() {
  return (
    <aside aria-label="Elitedom social links" className="el-social-dock">
      <span className="el-social-dock__accent" />
      <span className="el-social-dock__label"><span /> SOCIAL</span>
      <div className="el-social-dock__items">
        {networks.map((network) => (
          <a aria-label={network.label} href={network.href} key={network.label}>
            <img alt="" aria-hidden="true" src={network.icon} />
          </a>
        ))}
      </div>
    </aside>
  );
}
