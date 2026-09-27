// Ce que le serveur sait faire (la page adapte ses boutons en conséquence)
import { repondre } from './_commun.js';

export default function handler(req, res) {
  repondre(res, 200, {
    rendu: !!process.env.FAL_KEY,
    monde: !!process.env.WLT_API_KEY,
    code: !!process.env.ACCES_CODE
  });
}
