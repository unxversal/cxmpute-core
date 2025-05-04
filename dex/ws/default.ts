import {
  APIGatewayProxyResultV2,
} from "aws-lambda";

export const handler = async (
): Promise<APIGatewayProxyResultV2> => {
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: false, msg: "unknown action" }),
  };
};