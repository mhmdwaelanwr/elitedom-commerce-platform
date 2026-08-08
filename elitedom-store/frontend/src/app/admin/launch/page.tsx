const launchControlContract = {
  requiredPermission: "config.manage",
  releaseRef: "required",
  evidence_ref: "required",
} as const;

export default function LaunchControlPage() {
  return (
    <main className="clean-room">
      <div className="clean-room__content">
        <p className="clean-room__eyebrow">Elitedom operations</p>
        <h1 className="clean-room__title">Launch control</h1>
        <p className="clean-room__text">
          The previous admin interface was removed during the frontend clean-room reset.
          This route remains only as the release-control contract that Stage 11 will rebuild.
        </p>
        <dl className="clean-room__contract" aria-label="Launch control contract">
          <div>
            <dt>Write permission</dt>
            <dd>{launchControlContract.requiredPermission}</dd>
          </div>
          <div>
            <dt>Release reference</dt>
            <dd>{launchControlContract.releaseRef}</dd>
          </div>
          <div>
            <dt>Evidence reference</dt>
            <dd>{launchControlContract.evidence_ref}</dd>
          </div>
        </dl>
      </div>
    </main>
  );
}
