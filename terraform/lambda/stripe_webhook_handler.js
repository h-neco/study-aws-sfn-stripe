exports.handler = async (event) => {
  console.log("Stripe webhook handler called");
  console.log("Received event:", JSON.stringify(event));

  // TaskToken が渡されてくる（待機解除に必要）
  if (event.taskToken) {
    console.log("Received taskToken:", event.taskToken);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Hello from stripe webhook handler" }),
  };
};
