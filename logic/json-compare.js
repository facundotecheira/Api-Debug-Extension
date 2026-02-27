const JsonComparer = {
    compare(json1, json2) {
        if (!json1 && !json2) {
            return { type: 'info', message: '📝 Pegá dos JSON para comparar' };
        }
        
        try {
            let obj1, obj2;
            
            try {
                obj1 = JSON.parse(json1);
            } catch (e) {
                obj1 = JsonComparer.tryFixJson(json1);
                if (!obj1) throw new Error('JSON1 inválido');
            }
            
            try {
                obj2 = JSON.parse(json2);
            } catch (e) {
                obj2 = JsonComparer.tryFixJson(json2);
                if (!obj2) throw new Error('JSON2 inválido');
            }
            
            const array1 = JsonComparer.ensureArray(obj1);
            const array2 = JsonComparer.ensureArray(obj2);
            
            const info = `📊 JSON1: ${array1.length} elementos | JSON2: ${array2.length} elementos`;
            
            const diferencias = JsonComparer.encontrarDiferencias(array1, array2);
            
            if (diferencias.length === 0) {
                return { type: 'success', message: info + '<br>✅ Los JSON son idénticos' };
            } else {
                return { 
                    type: 'differences', 
                    message: info,
                    differences: diferencias 
                };
            }
            
        } catch (e) {
            return { type: 'error', message: `❌ ${e.message}` };
        }
    },
    
    encontrarDiferencias(arr1, arr2) {
        const diferencias = [];
        const maxLength = Math.max(arr1.length, arr2.length);
        
        for (let i = 0; i < maxLength; i++) {
            const item1 = arr1[i];
            const item2 = arr2[i];
            
            if (!item1 && item2) {
                diferencias.push({
                    tipo: 'solo_en_segundo',
                    ruta: `[${i}]`,
                    mensaje: `Elemento en posición [${i}] solo existe en JSON2`
                });
            } else if (item1 && !item2) {
                diferencias.push({
                    tipo: 'solo_en_primero',
                    ruta: `[${i}]`,
                    mensaje: `Elemento en posición [${i}] solo existe en JSON1`
                });
            } else if (item1 && item2) {
                const diffs = JsonComparer.compararObjetos(item1, item2, `[${i}]`);
                diferencias.push(...diffs);
            }
        }
        
        return diferencias;
    },
    
    compararObjetos(obj1, obj2, ruta = '') {
        const diferencias = [];
        
        if (obj1 === null || obj2 === null || typeof obj1 !== typeof obj2) {
            if (JSON.stringify(obj1) !== JSON.stringify(obj2)) {
                diferencias.push({
                    tipo: 'valor_diferente',
                    ruta: ruta || 'raíz',
                    valor1: obj1,
                    valor2: obj2
                });
            }
            return diferencias;
        }
        
        if (typeof obj1 !== 'object') {
            if (obj1 !== obj2) {
                diferencias.push({
                    tipo: 'valor_diferente',
                    ruta: ruta || 'raíz',
                    valor1: obj1,
                    valor2: obj2
                });
            }
            return diferencias;
        }
        
        if (Array.isArray(obj1) && Array.isArray(obj2)) {
            const maxLen = Math.max(obj1.length, obj2.length);
            for (let i = 0; i < maxLen; i++) {
                const nuevaRuta = ruta ? `${ruta}[${i}]` : `[${i}]`;
                const val1 = obj1[i];
                const val2 = obj2[i];
                
                if (val1 === undefined && val2 !== undefined) {
                    diferencias.push({
                        tipo: 'solo_en_segundo',
                        ruta: nuevaRuta,
                        mensaje: `Elemento en ${nuevaRuta} solo existe en JSON2`
                    });
                } else if (val1 !== undefined && val2 === undefined) {
                    diferencias.push({
                        tipo: 'solo_en_primero',
                        ruta: nuevaRuta,
                        mensaje: `Elemento en ${nuevaRuta} solo existe en JSON1`
                    });
                } else {
                    const subDiffs = JsonComparer.compararObjetos(val1, val2, nuevaRuta);
                    diferencias.push(...subDiffs);
                }
            }
            return diferencias;
        }
        
        const todasLasKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
        
        for (const key of todasLasKeys) {
            const nuevaRuta = ruta ? `${ruta}.${key}` : key;
            const val1 = obj1[key];
            const val2 = obj2[key];
            
            if (val1 === undefined && val2 !== undefined) {
                diferencias.push({
                    tipo: 'solo_en_segundo',
                    ruta: nuevaRuta,
                    mensaje: `Propiedad "${key}" solo existe en JSON2`,
                    valor2: val2
                });
            } else if (val1 !== undefined && val2 === undefined) {
                diferencias.push({
                    tipo: 'solo_en_primero',
                    ruta: nuevaRuta,
                    mensaje: `Propiedad "${key}" solo existe en JSON1`,
                    valor1: val1
                });
            } else {
                const subDiffs = JsonComparer.compararObjetos(val1, val2, nuevaRuta);
                diferencias.push(...subDiffs);
            }
        }
        
        return diferencias;
    },
    
    tryFixJson(str) {
        try {
            if (str.includes('}{')) {
                const fixed = '[' + str.replace(/}{/g, '},{') + ']';
                return JSON.parse(fixed);
            }
            
            const lines = str.split('\n').filter(l => l.trim());
            if (lines.length > 1) {
                const objects = lines
                    .map(l => l.trim())
                    .filter(l => l.startsWith('{') && l.endsWith('}'));
                
                if (objects.length > 1) {
                    const fixed = '[' + objects.join(',') + ']';
                    return JSON.parse(fixed);
                }
            }
            
            return null;
        } catch (e) {
            return null;
        }
    },
    
    ensureArray(obj) {
        if (Array.isArray(obj)) {
            return obj;
        } else if (obj && typeof obj === 'object') {
            return [obj];
        } else {
            return [];
        }
    },
    
    formatDifferences(diferencias) {
        if (diferencias.length === 0) return '<p class="success-message">✅ No hay diferencias</p>';
        
        let html = '<div class="differences-container">';
        
        diferencias.forEach(diff => {
            if (diff.tipo === 'valor_diferente') {
                const val1Str = diff.valor1 === null ? 'null' : 
                               (typeof diff.valor1 === 'string' ? `"${diff.valor1}"` : JSON.stringify(diff.valor1));
                const val2Str = diff.valor2 === null ? 'null' : 
                               (typeof diff.valor2 === 'string' ? `"${diff.valor2}"` : JSON.stringify(diff.valor2));
                
                html += `
                    <div class="diff-item" style="border-left-color: #e5c07b; margin-bottom: 8px; padding: 10px;">
                        <div style="color: #e5c07b; font-family: monospace; font-weight: bold; margin-bottom: 5px;">
                            📊 ${diff.ruta}
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-left: 20px;">
                            <span style="color: #e06c75; background: #2d2d2d; padding: 2px 8px; border-radius: 3px; font-family: monospace;">${val1Str}</span>
                            <span style="color: #abb2bf;">→</span>
                            <span style="color: #98c379; background: #2d2d2d; padding: 2px 8px; border-radius: 3px; font-family: monospace;">${val2Str}</span>
                        </div>
                    </div>
                `;
            } else {
                const icono = diff.tipo === 'solo_en_primero' ? '➖' : '➕';
                const color = diff.tipo === 'solo_en_primero' ? '#e06c75' : '#98c379';
                
                html += `
                    <div class="diff-item" style="border-left-color: ${color}; margin-bottom: 8px; padding: 8px;">
                        <div style="color: ${color}; font-family: monospace;">
                            ${icono} ${diff.mensaje || diff.ruta}
                        </div>
                    </div>
                `;
            }
        });
        
        html += '</div>';
        return html;
    }
};

if(!window.JsonComparer) window.JsonComparer = JsonComparer;