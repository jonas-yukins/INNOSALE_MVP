const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const knowledgeBasePath = path.join(__dirname, "..", "knowledge_base.json");
const knowledgeBase = JSON.parse(fs.readFileSync(knowledgeBasePath, "utf-8"));

let extractorPromise = null;

async function getExtractor() {
	if (!extractorPromise) {
		extractorPromise = import("@xenova/transformers").then(({ pipeline }) =>
			pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2"),
		);
	}

	return extractorPromise;
}

function cosineSimilarity(a, b) {
	let dot = 0;
	let normA = 0;
	let normB = 0;

	for (let i = 0; i < a.length; i += 1) {
		dot += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}

	if (normA === 0 || normB === 0) {
		return 0;
	}

	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embedText(text) {
	const extractor = await getExtractor();
	const result = await extractor(text, { pooling: "mean", normalize: true });
	return Array.from(result.data);
}

function isProductValid(product, userPsi, userMaterial) {
	const psiValid = userPsi <= product.constraints.max_psi;
	const materialValid = product.constraints.compatible_materials
		.map((material) => material.toLowerCase())
		.includes(userMaterial.toLowerCase());

	return {
		valid: psiValid && materialValid,
		psiValid,
		materialValid,
	};
}

function computePrice(product, userPsi) {
	return product.pricing.base_price + userPsi * product.pricing.multiplier;
}

async function rankBySimilarity(userDescription, products) {
	const queryEmbedding = await embedText(userDescription);
	const results = [];

	for (const product of products) {
		const manualEmbedding = await embedText(product.manual_excerpt);
		const similarity = cosineSimilarity(queryEmbedding, manualEmbedding);

		results.push({
			product,
			similarity,
		});
	}

	results.sort((a, b) => b.similarity - a.similarity);
	return results;
}

app.get("/health", (_req, res) => {
	res.json({ ok: true });
});

app.post("/validate", async (req, res) => {
	try {
		const {
			user_psi: rawPsi,
			user_material: rawMaterial,
			user_description: rawDescription,
			product_id: productId,
		} = req.body;

		const userPsi = Number(rawPsi);
		const userMaterial = String(rawMaterial || "").trim();
		const userDescription = String(rawDescription || "").trim();

		if (!Number.isFinite(userPsi) || !userMaterial || !userDescription) {
			return res.status(400).json({
				error: "user_psi, user_material, and user_description are required.",
			});
		}

		const similarityRanking = await rankBySimilarity(userDescription, knowledgeBase);

		let selected = similarityRanking[0]?.product;

		if (productId) {
			const explicitProduct = knowledgeBase.find((entry) => entry.product_id === productId);
			if (explicitProduct) {
				selected = explicitProduct;
			}
		}

		if (!selected) {
			return res.status(404).json({
				is_valid: false,
				error: "No matching product found. Suggesting General Purpose pump.",
				suggestion: {
					product_id: "general-purpose",
					name: "General Purpose Pump",
					reason: "Inference engine fallback when no semantic match is available.",
				},
			});
		}

		const validation = isProductValid(selected, userPsi, userMaterial);
		const estimatedPrice = computePrice(selected, userPsi);

		if (validation.valid) {
			return res.json({
				is_valid: true,
				product: selected.name,
				product_id: selected.product_id,
				estimated_price: estimatedPrice,
				traceability: selected.manual_excerpt,
				details: {
					max_psi: selected.constraints.max_psi,
					compatible_materials: selected.constraints.compatible_materials,
				},
			});
		}

		const validCandidates = knowledgeBase.filter(
			(product) => isProductValid(product, userPsi, userMaterial).valid,
		);
		const suggestedRanking = await rankBySimilarity(userDescription, validCandidates);
		const closestValid = suggestedRanking[0]?.product;

		if (!closestValid) {
			return res.json({
				is_valid: false,
				product: selected.name,
				product_id: selected.product_id,
				estimated_price: estimatedPrice,
				traceability: selected.manual_excerpt,
				violations: {
					psi: !validation.psiValid ? `Requested PSI exceeds ${selected.constraints.max_psi}.` : null,
					material: !validation.materialValid
						? `Material "${userMaterial}" not in ${selected.constraints.compatible_materials.join(", ")}.`
						: null,
				},
				suggestion: {
					product_id: "general-purpose",
					name: "General Purpose Pump",
					reason: "No valid product found for this PSI and material.",
				},
			});
		}

		return res.json({
			is_valid: false,
			product: selected.name,
			product_id: selected.product_id,
			estimated_price: estimatedPrice,
			traceability: selected.manual_excerpt,
			violations: {
				psi: !validation.psiValid ? `Requested PSI exceeds ${selected.constraints.max_psi}.` : null,
				material: !validation.materialValid
					? `Material "${userMaterial}" not in ${selected.constraints.compatible_materials.join(", ")}.`
					: null,
			},
			suggestion: {
				product_id: closestValid.product_id,
				name: closestValid.name,
				estimated_price: computePrice(closestValid, userPsi),
				traceability: closestValid.manual_excerpt,
			},
		});
	} catch (error) {
		return res.status(500).json({
			is_valid: false,
			error: "Inference engine failure. Suggesting General Purpose pump.",
			suggestion: {
				product_id: "general-purpose",
				name: "General Purpose Pump",
			},
			details: error.message,
		});
	}
});

app.listen(port, () => {
	console.log(`Inference backend running on http://localhost:${port}`);
});
