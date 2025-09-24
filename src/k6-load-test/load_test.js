import http from "k6/http";
import { check } from "k6";
import { Rate } from "k6/metrics";

// track failed requests
export let errorRate = new Rate("errors");

export let options = {
  scenarios: {
    // gradually ramp up requests
    ramping_load: {
      executor: "ramping-arrival-rate",
      startRate: 100,      // start with 100 requests/sec
      timeUnit: "1s",
      preAllocatedVUs: 50,  // initial virtual users
      maxVUs: 1000,          // max VUs allowed
      stages: [
        { target: 500, duration: "10s" },   // ramp to 500 RPS
        { target: 750, duration: "10s" },   // ramp to 750 RPS
        { target: 1000, duration: "10s" },  // ramp to 1000 RPS
        { target: 0, duration: "5s" },      // cool down
      ],
    },
  },
  thresholds: {
    errors: ["rate<0.05"], // less than 5% errors
  },
};

export default function () {
  const url = "http://localhost:3000/api/urls/shorten";
  const payload = JSON.stringify({ long_url: "http://www.google.com" });

  const params = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  let res = http.post(url, payload, params);

  // Check for 201 status code
  const checkRes = check(res, {
    "status is 201": (r) => r.status === 201,
  });

  // errors
  errorRate.add(!checkRes);
}
