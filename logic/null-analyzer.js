const NullAnalyzer = {
    findNullFields(obj, padre = 'raíz', path = '') {
        let resultados = [];
        
        for (const key in obj) {
            const valor = obj[key];
            const currentPath = path ? `${path}.${key}` : key;
            const padreActual = padre;
            
            if (valor === null) {
                resultados.push({
                    campo: key,
                    path: currentPath,
                    padre: padreActual,
                    valor: null,
                    tipo: 'null'
                });
            } else if (Array.isArray(valor)) {
                valor.forEach((item, index) => {
                    resultados = resultados.concat(
                        NullAnalyzer.findNullFields(
                            item, 
                            `${key}[${index}]`, 
                            `${currentPath}[${index}]`
                        )
                    );
                });
            } else if (typeof valor === 'object' && valor !== null) {
                resultados = resultados.concat(
                    NullAnalyzer.findNullFields(valor, key, currentPath)
                );
            }
        }
        
        return resultados;
    },
    
    inferTypeFromSchema(valor) {
        if (valor === null) return 'null';
        if (Array.isArray(valor)) return 'array';
        
        switch(typeof valor) {
            case 'string':
                if (!isNaN(valor) && valor.trim() !== '') return 'number';
                if (valor.toLowerCase() === 'true' || valor.toLowerCase() === 'false') return 'boolean';
                return 'string';
            case 'number':
                return 'number';
            case 'boolean':
                return 'boolean';
            case 'object':
                return 'object';
            default:
                return typeof valor;
        }
    },
    
    compareWithSchema(camposNull, schemaObj) {
        const resultados = {
            camposNull: camposNull,
            compatibles: [],
            incompatibles: [],
            noEnSchema: [],
            resumen: {
                totalNull: camposNull.length,
                compatibles: 0,
                incompatibles: 0,
                noEnSchema: 0
            }
        };
        
        function buscarEnSchema(path) {
            const partes = path.split('.');
            let actual = schemaObj;
            
            for (let i = 0; i < partes.length; i++) {
                const parte = partes[i];
                
                if (parte.includes('[')) {
                    const arrayMatch = parte.match(/(.+)\[(\d+)\]/);
                    if (arrayMatch) {
                        const arrayName = arrayMatch[1];
                        if (actual[arrayName] && Array.isArray(actual[arrayName])) {
                            actual = actual[arrayName][0] || {};
                        } else {
                            return null;
                        }
                    }
                } else {
                    if (actual && typeof actual === 'object' && parte in actual) {
                        actual = actual[parte];
                    } else {
                        return null;
                    }
                }
            }
            
            return actual;
        }
        
        camposNull.forEach(campoInfo => {
            const valorSchema = buscarEnSchema(campoInfo.path);
            
            if (valorSchema === undefined) {
                resultados.noEnSchema.push({
                    ...campoInfo,
                    sugerencia: '❓ No existe en el JSON de referencia'
                });
                resultados.resumen.noEnSchema++;
            } else {
                const tipoSchema = NullAnalyzer.inferTypeFromSchema(valorSchema);
                const puedeSerNull = valorSchema === null;
                
                if (puedeSerNull) {
                    resultados.compatibles.push({
                        ...campoInfo,
                        tipoSchema: tipoSchema,
                        sugerencia: '✅ Puede ser null (el schema también lo tiene como null)'
                    });
                    resultados.resumen.compatibles++;
                } else {
                    resultados.incompatibles.push({
                        ...campoInfo,
                        tipoSchema: tipoSchema,
                        valorEjemplo: valorSchema,
                        sugerencia: `⚠️ NO debería ser null. El schema espera tipo: ${tipoSchema}`,
                        valorPorDefecto: NullAnalyzer.getDefaultValue(tipoSchema, valorSchema)
                    });
                    resultados.resumen.incompatibles++;
                }
            }
        });
        
        return resultados;
    },
    
    getDefaultValue(tipo, valorEjemplo) {
        if (valorEjemplo !== undefined) {
            return JSON.stringify(valorEjemplo);
        }
        
        switch(tipo) {
            case 'number':
                return '0';
            case 'string':
                return '""';
            case 'boolean':
                return 'false';
            case 'array':
                return '[]';
            case 'object':
                return '{}';
            default:
                return 'null';
        }
    },
    
    formatResults(analisis) {
        let html = `
            <div style="background: #1e1e1e; border-radius: 4px; padding: 15px;">
                <h3 style="color: #61afef; margin-bottom: 15px;">📊 Análisis de Campos Null vs Schema</h3>
                
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;">
                    <div style="background: #2d2d2d; padding: 10px; border-radius: 4px; text-align: center;">
                        <div style="color: #abb2bf; font-size: 12px;">Total Nulls</div>
                        <div style="color: #e5c07b; font-size: 24px; font-weight: bold;">${analisis.resumen.totalNull}</div>
                    </div>
                    <div style="background: #2d2d2d; padding: 10px; border-radius: 4px; text-align: center;">
                        <div style="color: #abb2bf; font-size: 12px;">✅ Compatibles</div>
                        <div style="color: #98c379; font-size: 24px; font-weight: bold;">${analisis.resumen.compatibles}</div>
                    </div>
                    <div style="background: #2d2d2d; padding: 10px; border-radius: 4px; text-align: center;">
                        <div style="color: #abb2bf; font-size: 12px;">⚠️ Incompatibles</div>
                        <div style="color: #e06c75; font-size: 24px; font-weight: bold;">${analisis.resumen.incompatibles}</div>
                    </div>
                </div>
        `;
        
        if (analisis.incompatibles.length > 0) {
            html += `
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #e06c75; margin-bottom: 10px;">⚠️ Campos que NO deberían ser null</h4>
                    ${analisis.incompatibles.map(c => `
                        <div style="background: #2d2d2d; padding: 12px; margin-bottom: 8px; border-radius: 4px; border-left: 4px solid #e06c75;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                <div>
                                    <code style="color: #e5c07b; font-size: 13px;">${c.path}</code>
                                    <span style="color: #abb2bf; margin-left: 10px; font-size: 12px;">(en ${c.padre})</span>
                                </div>
                                <span style="color: #e06c75; background: #3e3e3e; padding: 2px 6px; border-radius: 3px; font-size: 11px;">${c.tipoSchema}</span>
                            </div>
                            <div style="color: #e5c07b; font-size: 12px; margin-top: 5px;">
                                💡 ${c.sugerencia}
                            </div>
                            <div style="color: #98c379; font-size: 12px; margin-top: 5px; background: #1e1e1e; padding: 5px; border-radius: 3px;">
                                🔧 Valor de ejemplo: ${c.valorPorDefecto}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        if (analisis.compatibles.length > 0) {
            html += `
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #98c379; margin-bottom: 10px;">✅ Campos que pueden ser null</h4>
                    ${analisis.compatibles.map(c => `
                        <div style="background: #2d2d2d; padding: 8px; margin-bottom: 5px; border-radius: 4px; border-left: 3px solid #98c379;">
                            <code style="color: #e5c07b;">${c.path}</code>
                            <span style="color: #abb2bf; margin-left: 10px;">(en ${c.padre})</span>
                            <span style="color: #98c379; float: right;">${c.tipoSchema}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        if (analisis.noEnSchema.length > 0) {
            html += `
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #abb2bf; margin-bottom: 10px;">❓ Campos no encontrados en schema</h4>
                    ${analisis.noEnSchema.map(c => `
                        <div style="background: #2d2d2d; padding: 8px; margin-bottom: 5px; border-radius: 4px; border-left: 3px solid #abb2bf;">
                            <code style="color: #e5c07b;">${c.path}</code>
                            <span style="color: #abb2bf; margin-left: 10px;">(en ${c.padre})</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        html += `</div>`;
        return html;
    },
    
    showNullsOnly(camposNull) {
        if (camposNull.length === 0) {
            return `
                <div style="background: #1e1e1e; border-radius: 4px; padding: 20px; text-align: center;">
                    <p style="color: #98c379; font-size: 16px;">✅ No hay campos null en el body actual</p>
                </div>
            `;
        }
        
        let html = `
            <div style="background: #1e1e1e; border-radius: 4px; padding: 15px;">
                <h3 style="color: #61afef; margin-bottom: 15px;">🔍 Campos Null Detectados</h3>
                <p style="color: #abb2bf; margin-bottom: 15px;">Total: ${camposNull.length} campos null</p>
        `;
        
        const porPadre = {};
        camposNull.forEach(c => {
            if (!porPadre[c.padre]) porPadre[c.padre] = [];
            porPadre[c.padre].push(c);
        });
        
        for (const [padre, campos] of Object.entries(porPadre)) {
            html += `
                <div style="margin-bottom: 15px;">
                    <h4 style="color: #e5c07b; margin-bottom: 8px;">📁 ${padre === 'raíz' ? 'Raíz' : padre}</h4>
                    ${campos.map(c => `
                        <div style="background: #2d2d2d; padding: 8px 12px; margin-bottom: 4px; border-radius: 4px; border-left: 3px solid #e5c07b;">
                            <code style="color: #e5c07b;">${c.campo}</code>
                            <span style="color: #abb2bf; margin-left: 10px; font-size: 12px;">ruta: ${c.path}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        html += `
            <div style="margin-top: 20px; padding: 10px; background: #2d2d2d; border-radius: 4px; border-left: 3px solid #61afef;">
                <p style="color: #abb2bf; margin-bottom: 5px;">📌 Para validar tipos:</p>
                <p style="color: #98c379; font-size: 12px;">1. Pegá un JSON de referencia abajo</p>
                <p style="color: #98c379; font-size: 12px;">2. Hacé click en "Comparar con Schema"</p>
            </div>
        `;
        
        html += `</div>`;
        return html;
    }
};

if(!window.NullAnalyzer) window.NullAnalyzer = NullAnalyzer;