function short(value: string) {
  if (!value || value === "local") return "local";
  return value.slice(0, 7);
}

export function DeployMarker() {
  const git = __GIT_BRANCH__ === "local" ? short(__GIT_SHA__) : `${__GIT_BRANCH__}@${short(__GIT_SHA__)}`;
  return <div className="deploy-marker">gh: {git} · nf: {short(__NETLIFY_DEPLOY_ID__)}</div>;
}
