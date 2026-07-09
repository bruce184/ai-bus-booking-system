import {
  executeGetBookingStatus,
  executeSearchTrips,
  policyResources
} from "../../../lib/chatbot/tools";

export async function POST(request) {
  const body = await request.json();

  try {
    if (body.intent === "policy") {
      const policy = policyResources[body.policy];
      if (!policy) {
        return Response.json({ answer: "Minh chua co resource chinh sach nay trong MCP resources." });
      }
      return Response.json({
        answer: `${policy.source}: ${policy.text}`,
        source: policy.source
      });
    }

    if (body.intent === "searchTrips") {
      const data = await executeSearchTrips(body.input ?? {});
      return Response.json({
        answer: `Ket qua duoc lay tu tool searchTrips:\n${JSON.stringify(data, null, 2)}`
      });
    }

    if (body.intent === "getBookingStatus") {
      const input = body.input ?? {};
      if (!input.bookingCode || !input.email) {
        return Response.json({
          answer: "Minh can ca booking code va email de tra cuu thong tin rieng tu cua booking."
        });
      }
      const data = await executeGetBookingStatus(input);
      return Response.json({
        answer: `Trang thai booking duoc lay tu tool getBookingStatus:\n${JSON.stringify(data, null, 2)}`
      });
    }

    return Response.json({
      answer:
        "Minh co the goi tool searchTrips, getBookingStatus, hoac tra loi chinh sach tu MCP resources. Minh se khong tu bia trip inventory hay booking status."
    });
  } catch (error) {
    return Response.json(
      {
        answer: `Khong lay duoc du lieu tu tool hien tai: ${error.message}. Minh se khong tu tao du lieu thay the.`
      },
      { status: 502 }
    );
  }
}
