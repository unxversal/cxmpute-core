import { Handler } from "aws-lambda";
import fetch from "node-fetch";

export const handler: Handler = async () => {
  try {
    const url = process.env.ROLLOVER_URL ?? "https://api.cxmpute.cloud/api/admin/rewards/rollover";
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    console.log("rewards rollover triggered", await res.json());
  } catch (e) {
    console.error("rewardsCron", e);
    throw e;
  }
}; 