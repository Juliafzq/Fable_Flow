#include <metal_stdlib>
using namespace metal;

struct OdometerUniforms {
    float cumulativeAngleDegrees; // 0.0 ... 1080.0 (3 full turns of 360° = 180 minutes)
    float3 assignedHeirloomRGB;   // Quadrant signature heirloom red color
    float3 unassignedGrayRGB;     // Matte neutral gray (#8E8D8A)
    float assignmentMix;          // 0.0 = Unassigned Gray, 1.0 = Assigned Heirloom Red
    int activeTurnIndex;          // 0 = Turn 1 (0–60m), 1 = Turn 2 (65–120m), 2 = Turn 3 (125–180m)
};

struct VertexOut {
    float4 position [[position]];
    float3 worldNormal;
    float2 uv;
};

/// Computes the dynamic odometer minute value for a given angular slice around the tomato equator.
/// Turn 0: 0..60, Turn 1: 65..120, Turn 2: 125..180 (PRD §6.#2.B & Mockup p. 11: "130 140 150 160").
inline int computeEquatorialMinuteNumber(float longitudeDegrees, float cumulativeAngleDegrees) {
    float totalRotationTurns = floor(clamp(cumulativeAngleDegrees, 0.0f, 1079.9f) / 360.0f);
    int turnOffsetMinutes = int(totalRotationTurns) * 60;
    int baseNotchMinutes = int(round(fmod(longitudeDegrees + 360.0f, 360.0f) / 6.0f));
    return clamp(turnOffsetMinutes + baseNotchMinutes, 0, 180);
}

fragment float4 tomatoOdometerSurfaceFragment(
    VertexOut in [[stage_in]],
    constant OdometerUniforms &uniforms [[buffer(0)]],
    texture2d<float> numberAtlasTexture [[texture(0)]]
) {
    constexpr sampler linearSampler(mag_filter::linear, min_filter::linear, address::repeat);

    // 1. Blend between Unassigned Matte Gray and Quadrant Heirloom Red
    float3 baseAlbedo = mix(uniforms.unassignedGrayRGB, uniforms.assignedHeirloomRGB, saturate(uniforms.assignmentMix));

    // 2. Soft ceramic/heirloom matte studio lighting
    float3 lightDir = normalize(float3(-0.38f, 0.74f, 0.55f));
    float3 normal = normalize(in.worldNormal);
    float ndotl = saturate(dot(normal, lightDir));
    float ambient = 0.42f;
    float rim = pow(1.0f - saturate(normal.z), 2.4f) * 0.12f;
    float3 litColor = baseAlbedo * (ambient + ndotl * 0.62f) + float3(rim);

    // 3. Equatorial Notch & Dynamic 3-Turn Number Band (around equator UV.y in [0.46, 0.54])
    float equatorBandMask = smoothstep(0.45f, 0.465f, in.uv.y) * (1.0f - smoothstep(0.535f, 0.55f, in.uv.y));
    if (equatorBandMask > 0.001f) {
        float rotatedU = fract(in.uv.x + (uniforms.cumulativeAngleDegrees / 360.0f));
        float degreeOnRing = rotatedU * 360.0f;

        // Major tick every 30° (10m/5m notch), minor subdivision ticks every 6° (1m)
        float distToMinorTick = abs(fmod(degreeOnRing + 3.0f, 6.0f) - 3.0f);
        float distToMajorTick = abs(fmod(degreeOnRing + 15.0f, 30.0f) - 15.0f);

        float minorTickAlpha = (1.0f - smoothstep(0.18f, 0.42f, distToMinorTick)) * step(in.uv.y, 0.505f);
        float majorTickAlpha = (1.0f - smoothstep(0.22f, 0.50f, distToMajorTick)) * step(in.uv.y, 0.525f);

        // Shift UV lookup into the 3-turn number atlas row (Row 0: 0-60, Row 1: 65-120, Row 2: 125-180)
        float atlasRow = float(clamp(uniforms.activeTurnIndex, 0, 2)) / 3.0f;
        float2 atlasUV = float2(rotatedU, atlasRow + (in.uv.y - 0.46f) * 4.0f);
        float numberAlpha = numberAtlasTexture.sample(linearSampler, atlasUV).r;

        float paintMask = saturate(max(max(minorTickAlpha * 0.75f, majorTickAlpha), numberAlpha * 0.92f)) * equatorBandMask;
        litColor = mix(litColor, float3(0.96f, 0.95f, 0.93f), paintMask);
    }

    return float4(litColor, 1.0f);
}
