import { useMemo, useState } from "react";

const backendUrl = "http://localhost:3001";

function App() {
	const [description, setDescription] = useState("I need a pump for high-pressure steel cleaning");
	const [psi, setPsi] = useState(7000);
	const [material, setMaterial] = useState("steel");
	const [isLoading, setIsLoading] = useState(false);
	const [response, setResponse] = useState(null);
	const [error, setError] = useState("");

	const gatekeeper = useMemo(() => {
		if (!response) {
			return { label: "WAITING", color: "bg-slate-500/70" };
		}

		return response.is_valid
			? { label: "VALID", color: "bg-emerald-500" }
			: { label: "INVALID", color: "bg-red-500" };
	}, [response]);

	const noValidMatch = useMemo(() => {
		if (!response || response.is_valid) {
			return false;
		}

		return response?.suggestion?.product_id === "general-purpose";
	}, [response]);

	const onSubmit = async (event) => {
		event.preventDefault();
		setIsLoading(true);
		setError("");

		try {
			const result = await fetch(`${backendUrl}/validate`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					user_psi: Number(psi),
					user_material: material,
					user_description: description,
				}),
			});

			const payload = await result.json();
			if (!result.ok) {
				throw new Error(payload.error || "Request failed.");
			}

			setResponse(payload);
		} catch (submitError) {
			setError(submitError.message);
			setResponse(null);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<main className="mx-auto flex h-full max-w-5xl flex-col gap-4 p-4 text-slate-100">
			<header className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
				<h1 className="text-2xl font-semibold">InnoSale - Inference Engine (MVP)</h1>
				<p className="mt-1 text-sm text-slate-300">
					Validate industrial pump configurations with AI-assisted matching.
				</p>
			</header>

			<section className="grid flex-1 gap-4 md:grid-cols-5">
				<div className="md:col-span-3 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
					<h2 className="mb-3 text-lg font-medium">Dyad-Style Sales Chat</h2>
					<div className="mb-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm">
						<p className="text-slate-300">Salesperson</p>
						<p className="mt-1 text-slate-100">
							"{description || "Type your product request below..."}"
						</p>
					</div>

					<form onSubmit={onSubmit} className="space-y-3">
						<textarea
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							className="h-28 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm outline-none ring-indigo-300 transition focus:ring"
							placeholder="I need a pump for high-pressure steel cleaning"
							required
						/>
						<div className="grid gap-3 sm:grid-cols-2">
							<input
								type="number"
								min="0"
								value={psi}
								onChange={(event) => setPsi(event.target.value)}
								className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm outline-none ring-indigo-300 transition focus:ring"
								placeholder="Required PSI"
								required
							/>
							<input
								type="text"
								value={material}
								onChange={(event) => setMaterial(event.target.value)}
								className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm outline-none ring-indigo-300 transition focus:ring"
								placeholder="Material (e.g. steel)"
								required
							/>
						</div>
						<button
							type="submit"
							disabled={isLoading}
							className="w-full rounded-xl bg-indigo-500 px-4 py-2 font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-900"
						>
							{isLoading ? "Running inference..." : "Validate Configuration"}
						</button>
					</form>
				</div>

				<aside className="md:col-span-2 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
					<h2 className="mb-3 text-lg font-medium">Gatekeeper</h2>
					<div className="flex items-center gap-2 text-sm">
						<span className={`inline-block h-3 w-3 rounded-full ${gatekeeper.color}`} />
						<span className="font-semibold">{gatekeeper.label}</span>
					</div>

					{error ? <p className="mt-4 rounded-lg bg-red-950/60 p-3 text-sm text-red-200">{error}</p> : null}

					{response ? (
						<div className="mt-4 space-y-3 text-sm">
							{noValidMatch ? (
								<div className="rounded-xl border border-amber-700 bg-amber-950/30 p-3">
									<p className="font-medium text-amber-100">
										No valid configuration found. Please adjust inputs and try again.
									</p>
								</div>
							) : (
								<>
									<div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
										<p className="text-slate-300">Selected Product</p>
										<p className="font-medium text-slate-100">{response.product}</p>
									</div>
									<div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
										<p className="text-slate-300">Estimated Price</p>
										<p className="font-medium text-slate-100">
											${Math.round(response.estimated_price || 0).toLocaleString()}
										</p>
									</div>
								</>
							)}
							{response.suggestion && !noValidMatch ? (
								<div className="rounded-xl border border-indigo-700 bg-indigo-950/30 p-3">
									<p className="text-indigo-200">Suggested Valid Option</p>
									<p className="font-medium text-indigo-100">{response.suggestion.name}</p>
								</div>
							) : null}
						</div>
					) : null}
				</aside>
			</section>

			<section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
				<h2 className="text-lg font-medium">Traceability</h2>
				<p className="mt-2 rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-200">
					{response?.traceability || "Manual excerpt will be shown here after validation."}
				</p>
			</section>
		</main>
	);
}

export default App;
