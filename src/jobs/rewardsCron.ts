import { Handler } from "aws-lambda";
import fetch from "node-fetch";
import { Resource } from "sst";

export const handler: Handler = async () => {
  try {
    const url = Resource.RolloverUrl.value || "https://api.cxmpute.cloud/api/admin/rewards/rollover";
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    console.log("rewards rollover triggered", await res.json());
  } catch (e) {
    console.error("rewardsCron", e);
    throw e;
  }
}; 