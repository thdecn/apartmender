# Verovio 6.3.0 distribution notices

Unmodified official npm ESM modules; LGPL-3.0-or-later. Copyright (c) 2011-2026, RISM Digital Center and contributors. See COPYING and COPYING.LESSER.

Corresponding version-6.3.0 source archive is retained alongside these modules; official source: https://codeload.github.com/rism-digital/verovio/tar.gz/refs/tags/version-6.3.0; SHA-256 095a561e9bd26c97787ad49e01009576d1ca234feae3995948c5aede97a40598. Build recipe: emscripten/buildToolkit inside that archive. The modules are separate replaceable files; no proprietary binding is introduced. The modules were compared byte-for-byte with the official npm 6.3.0 tarball on 24 November 2026. This package uses the upstream prebuilt runtime, not a locally reproduced WASM build. Application glue is separate source in ../../notation/score-renderer.js and score-preview.js; these import the replaceable ESM files directly without bundling.

## Embedded fonts

# Fonts

* **[Leipzig](https://github.com/rism-digital/leipzig)** is Verovio's own font.
* **[Bravura](https://github.com/steinbergmedia/bravura)** is designed by Daniel Spreadbury.
* **[Gootville](https://github.com/musescore/MuseScore/tree/master/fonts/gootville)** is designed by Grzegorz Pruchniakowski and comes with [MuseScore](https://musescore.org/).
* **[Petaluma](https://github.com/steinbergmedia/petaluma)** is designed by [Steinberg](https://www.steinberg.net/).
* **[Leland](https://github.com/MuseScoreFonts/Leland)** has been developed for [MuseScore Studio](https://musescore.org/) (3.6).

## Text font

* **[Liberation](https://github.com/liberationfonts/liberation-fonts)** originally designed by Steve Matteson.

The five music fonts use SIL OFL (full notices below). **Text-font correction:** the actual embedded Liberation Serif identifies itself as Version 1.04, copyright 2007 Ascender, rather than the newer OFL release. It uses the older Liberation GPL v2 license with exceptions. See Liberation-NOTICE.txt, Liberation-LICENSE.txt and GPL-2.0.txt, retained from the font metadata and [the upstream 1.x project](https://github.com/liberationfonts/liberation-1.7-fonts). The unmodified embedded WOFF2 and its decompressed editable TrueType representation are provided alongside the exact source CSS in the Verovio archive; neither is an extra runtime fetch.


### Leipzig upstream SVG metadata


Created by FontForge 20251009 at Mon Aug  3 13:10:12 2026
 By Laurent Pugin
Created by Etienne Darbellay, Jean-Francois Marti, Laurent Pugin, and Klaus Rettinghaus.
This font is licensed under the SIL Open Font License \(https://openfontlicense.org/\).
Version 5.2.102

### Bravura upstream SVG metadata


Created by FontForge 20190801 at Fri Jan 29 23:57:12 2021
 By Unknown
Copyright \(c\) 2021, Steinberg Media Technologies GmbH \(http://www.steinberg.net/\), with Reserved Font Name "Bravura". This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is copied below, and is also available with a FAQ at: http://scripts.sil.org/OFL ----------------------------------------------------------- SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007 ----------------------------------------------------------- PREAMBLE The goals of the Open Font License \(OFL\) are to stimulate worldwide development of collaborative font projects, to support the font creation efforts of academic and linguistic communities, and to provide a free and open framework in which fonts may be shared and improved in partnership with others. The OFL allows the licensed fonts to be used, studied, modified and redistributed freely as long as they are not sold by themselves. The fonts, including any derivative works, can be bundled, embedded, redistributed and/or sold with any software provided that any reserved names are not used by derivative works. The fonts and derivatives, however, cannot be released under any other type of license. The requirement for fonts to remain under this license does not apply to any document created using the fonts or their derivatives. DEFINITIONS "Font Software" refers to the set of files released by the Copyright Holder\(s\) under this license and clearly marked as such. This may include source files, build scripts and documentation. "Reserved Font Name" refers to any names specified as such after the copyright statement\(s\). "Original Version" refers to the collection of Font Software components as distributed by the Copyright Holder\(s\). "Modified Version" refers to any derivative made by adding to, deleting, or substituting -- in part or in whole -- any of the components of the Original Version, by changing formats or by porting the Font Software to a new environment. "Author" refers to any designer, engineer, programmer, technical writer or other person who contributed to the Font Software. PERMISSION & CONDITIONS Permission is hereby granted, free of charge, to any person obtaining a copy of the Font Software, to use, study, copy, merge, embed, modify, redistribute, and sell modified and unmodified copies of the Font Software, subject to the following conditions: 1\) Neither the Font Software nor any of its individual components, in Original or Modified Versions, may be sold by itself. 2\) Original or Modified Versions of the Font Software may be bundled, redistributed and/or sold with any software, provided that each copy contains the above copyright notice and this license. These can be included either as stand-alone text files, human-readable headers or in the appropriate machine-readable metadata fields within text or binary files as long as those fields can be easily viewed by the user. 3\) No Modified Version of the Font Software may use the Reserved Font Name\(s\) unless explicit written permission is granted by the corresponding Copyright Holder. This restriction only applies to the primary font name as presented to the users. 4\) The name\(s\) of the Copyright Holder\(s\) or the Author\(s\) of the Font Software shall not be used to promote, endorse or advertise any Modified Version, except to acknowledge the contribution\(s\) of the Copyright Holder\(s\) and the Author\(s\) or with their explicit written permission. 5\) The Font Software, modified or unmodified, in part or in whole, must be distributed entirely under this license, and must not be distributed under any other license. The requirement for fonts to remain under this license does not apply to any document created using the Font Software. TERMINATION This license becomes null and void if any of the above conditions are not met. DISCLAIMER THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM OTHER DEALINGS IN THE FONT SOFTWARE.

### Gootville upstream SVG metadata


Created by FontForge 20251009 at Mon May 26 14:47:48 2025
 By Klaus Rettinghaus
Designed by Grzegorz Pruchniakowski.

This font is licensed under the SIL Open Font License (http://scripts.sil.org/OFL).

The Gootville font templates based on SMuFL and Bravura, designed by Daniel Spreadbury at Steinberg.

### Petaluma upstream SVG metadata


Created by FontForge 20201107 at Wed Jan 27 21:32:38 2021
 By Klaus Rettinghaus
Copyright \(c\) 2021, Steinberg Media Technologies GmbH \(http://www.steinberg.net/\), with Reserved Font Name "Petaluma".This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is copied below, and is also available with a FAQ at: http://scripts.sil.org/OFL-----------------------------------------------------------SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007-----------------------------------------------------------PREAMBLEThe goals of the Open Font License \(OFL\) are to stimulate worldwide development of collaborative font projects, to support the font creation efforts of academic and linguistic communities, and to provide a free and open framework in which fonts may be shared and improved in partnership with others.The OFL allows the licensed fonts to be used, studied, modified and redistributed freely as long as they are not sold by themselves. The fonts, including any derivative works, can be bundled, embedded, redistributed and/or sold with any software provided that any reserved names are not used by derivative works. The fonts and derivatives, however, cannot be released under any other type of license. The requirement for fonts to remain under this license does not apply to any document created using the fonts or their derivatives.DEFINITIONS"Font Software" refers to the set of files released by the Copyright Holder\(s\) under this license and clearly marked as such. This mayinclude source files, build scripts and documentation."Reserved Font Name" refers to any names specified as such after the copyright statement\(s\)."Original Version" refers to the collection of Font Software components as distributed by the Copyright Holder\(s\)."Modified Version" refers to any derivative made by adding to, deleting, or substituting -- in part or in whole -- any of the components of the Original Version, by changing formats or by porting the Font Software to a new environment."Author" refers to any designer, engineer, programmer, technical writer or other person who contributed to the Font Software.PERMISSION & CONDITIONSPermission is hereby granted, free of charge, to any person obtaining a copy of the Font Software, to use, study, copy, merge, embed, modify, redistribute, and sell modified and unmodified copies of the Font Software, subject to the following conditions:1\) Neither the Font Software nor any of its individual components, in Original or Modified Versions, may be sold by itself.2\) Original or Modified Versions of the Font Software may be bundled, redistributed and/or sold with any software, provided that each copy contains the above copyright notice and this license. These can be included either as stand-alone text files, human-readable headers or in the appropriate machine-readable metadata fields within text or binary files as long as those fields can be easily viewed by the user.3\) No Modified Version of the Font Software may use the Reserved Font Name\(s\) unless explicit written permission is granted by the corresponding Copyright Holder. This restriction only applies to the primary font name as presented to the users.4\) The name\(s\) of the Copyright Holder\(s\) or the Author\(s\) of the Font Software shall not be used to promote, endorse or advertise any Modified Version, except to acknowledge the contribution\(s\) of the Copyright Holder\(s\) and the Author\(s\) or with their explicit written permission.5\) The Font Software, modified or unmodified, in part or in whole, must be distributed entirely under this license, and must not be distributed under any other license. The requirement for fonts to remain under this license does not apply to any document created using the Font Software.TERMINATIONThis license becomes null and void if any of the above conditions are not met.DISCLAIMERTHE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM OTHER DEALINGS IN THE FONT SOFTWARE.

### Leland upstream SVG metadata


Created by FontForge 20251009 at Wed Sep 17 08:13:11 2025
 By Klaus Rettinghaus
Copyright \(c\) 2025, MuseScore BVBA \(http://www.musescore.org/\)

## include/json/LICENSE

Copyright (c) 2010 Hong Jiang

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.


## include/tuning-library/LICENSE.md

Copyright 2019-2020, Paul Walker

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.



## https://github.com/rism-digital/verovio/blob/version-6.3.0/src/pugi/pugixml.cpp

f PUGI_IMPL_MSVC_CRT_VERSION
#undef PUGI_IMPL_SNPRINTF
#undef PUGI_IMPL_NS_BEGIN
#undef PUGI_IMPL_NS_END
#undef PUGI_IMPL_FN
#undef PUGI_IMPL_FN_NO_INLINE
#undef PUGI_IMPL_GETHEADER_IMPL
#undef PUGI_IMPL_GETPAGE_IMPL
#undef PUGI_IMPL_GETPAGE
#undef PUGI_IMPL_NODETYPE
#undef PUGI_IMPL_IS_CHARTYPE_IMPL
#undef PUGI_IMPL_IS_CHARTYPE
#undef PUGI_IMPL_IS_CHARTYPEX
#undef PUGI_IMPL_ENDSWITH
#undef PUGI_IMPL_SKIPWS
#undef PUGI_IMPL_OPTSET
#undef PUGI_IMPL_PUSHNODE
#undef PUGI_IMPL_POPNODE
#undef PUGI_IMPL_SCANFOR
#undef PUGI_IMPL_SCANWHILE
#undef PUGI_IMPL_SCANWHILE_UNROLL
#undef PUGI_IMPL_ENDSEG
#undef PUGI_IMPL_THROW_ERROR
#undef PUGI_IMPL_CHECK_ERROR

#endif

/**
 * Copyright (c) 2006-2026 Arseny Kapoulkine
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */

## https://github.com/rism-digital/verovio/blob/version-6.3.0/src/crc/crc.cpp

/**********************************************************************
 *
 * Filename:    crc.c
 *
 * Description: Slow and fast implementations of the CRC standards.
 *
 * Notes:       The parameters for each supported CRC standard are
 *				defined in the header file crc.h.  The implementations
 *				here should stand up to further additions to that list.
 *
 *
 * Copyright (c) 2000 by Michael Barr.  This software is placed into
 * the public domain and may be used for any purpose.  However, this
 * notice must not be changed or removed and no warranty is either
 * expressed or implied by its publication or distribution.
 **********************************************************************/


#include "crc.h"

extern "C" {

/*
 * Derive parameters from the standard-specific parameters in crc.h.
 */
#define WIDTH    (8 * sizeof(crc))
#define TOPBIT   (1 << (WIDTH - 1))

#if (REFLECT_DATA == TRUE)
#undef  REFLECT_DATA
#define REFLECT_DATA(X)			((unsigned char) reflect((X), 8))
#else
#undef  REFLECT_DATA
#define REFLECT_DATA(X)			(X)
#endif

#if (REFLECT_REMAINDER == TRUE)
#undef  REFLECT_REMAINDER
#define REFLECT_REMAINDER(X)	((crc) reflect((X), WIDTH))
#else
#undef  REFLECT_REMAINDER
#define REFLECT_REMAINDER(X)	(X)
#endif


/*********************************************************************
 *
 * Function:    reflect()
 *
 * Description: Reorder the bits of a binary sequence, by reflecting
 *				them about the middle position.
 *
 * Notes:		No checking is done that nBits <= 32.
 *
 * Returns:		The reflection of the original data.
 *
 *********************************************************************/
static unsigned int
reflect(unsigned int data, unsigned char nBits)
{
	unsigned int  reflection = 0x00000000;
	unsigned char  bit;

	/*
	 * Reflect the data about the center bit.
	 */
	for (bit = 0; bit < nBits; ++bit)
	{
		/*
		 * If the LSB bit is set, set the reflection of it.
		 */
		if (data & 0x01)
		{
			reflection |= (1 << ((nBits - 1) - bit));
		}

		data = (data >> 1);
	}

	return (reflection);

}	/* reflect() */


/****************************

## https://github.com/rism-digital/verovio/blob/version-6.3.0/include/hum/humlib.h

//
// Programmer:    Craig Stuart Sapp <craig@ccrma.stanford.edu>
// Creation Date: Sat Aug  8 12:24:49 PDT 2015
// Last Modified: Mon Jun  8 21:10:33 PDT 2026
// Filename:      min/humlib.h
// URL:           https://github.com/craigsapp/humlib/blob/master/min/humlib.h
// Syntax:        C++11
// vim:           ts=3
//
// Description:   Include file for humlib library.
//
/*
https://github.com/craigsapp/humlib
Copyright (c) 2015-2021 Craig Stuart Sapp
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   and the following disclaimer in the documentation and/or other materials
   provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

*/

#ifndef _HUMLIB_H_INCLUDED
#define _HUMLIB_H_INCLUDED

#include <algorithm>
#include <cctype>
#include <chrono>
#include <cmath>
#include <cstdarg>
#include <cstring>
#include <cstring>
#include <ctime>
#include <fstream>
#include <functional>
#include <iomanip>
#include <iostream>
#include <list>
#include <locale>
#include <map>
#include <numeric>
#include <random>
#include <regex>
#include <set

## https://github.com/rism-digital/verovio/blob/version-6.3.0/include/zip/zip_file.hpp

// Copied from https://github.com/kkzi/miniz-cpp
// File https://github.com/kkzi/miniz-cpp/blob/main/include/miniz_cpp.hpp
// Commit https://github.com/kkzi/miniz-cpp/commit/62ec5c46c276d1880ba3b5a121d5a5dc24667b9e

// Copyright (c) 2014-2017 Thomas Fussell
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, WRISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE
//
// @license: http://www.opensource.org/licenses/mit-license.php

// Changed 05.11.2026 - remove use of comma operator

#pragma once

#include <algorithm>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <limits>
#include <memory>
#include <sstream>
#include <string>
#include <time.h>
#include <vector>

#define MINIZ_EXPORT
/* miniz.c 2.2.0 - public domain deflate/inflate, zlib-subset, ZIP reading/writing/appending, PNG writing
   See "unlicense" statement at the end of this file.
   Rich Geldreich <richgel99@gmail.com>, last updated Oct. 13, 2013
   Implements RFC 1950: http://www.ietf.org/rfc/rfc1950.txt and RFC 1951: http://www.ietf.org/rfc/rfc1951.txt

   Most API's defined in miniz.c are optional. For example, to disable the archive

## https://github.com/rism-digital/verovio/blob/version-6.3.0/fonts/Bravura/Bravura.svg

<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd" >
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1">
<metadata>
Created by FontForge 20190801 at Fri Jan 29 23:57:12 2021
 By Unknown
Copyright \(c\) 2021, Steinberg Media Technologies GmbH \(http://www.steinberg.net/\), with Reserved Font Name "Bravura". This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is copied below, and is also available with a FAQ at: http://scripts.sil.org/OFL ----------------------------------------------------------- SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007 ----------------------------------------------------------- PREAMBLE The goals of the Open Font License \(OFL\) are to stimulate worldwide development of collaborative font projects, to support the font creation efforts of academic and linguistic communities, and to provide a free and open framework in which fonts may be shared and improved in partnership with others. The OFL allows the licensed fonts to be used, studied, modified and redistributed freely as long as they are not sold by themselves. The fonts, including any derivative works, can be bundled, embedded, redistributed and/or sold with any software provided that any reserved names are not used by derivative works. The fonts and derivatives, however, cannot be released under any other type of license. The requirement for fonts to remain under this license does not apply to any document created using the fonts or their derivatives. DEFINITIONS "Font Software" refers to the set of files released by the Copyright Holder\(s\) under this license and clearly marked as such. This may include source files, build scripts and documentation. "Reserved Font Name" refers to any names specified as such after the copyright statement\(s\). "Original Version" refers to the collection of Font Software components as distributed by the Copyright Holder\(s\). "Modified Version" refers to any derivative made by adding to, deleting, or substituting -- in part or in whole -- any of the components of the Original Version, by changing formats or by porting the Font Software to a new environment. "Author" refers to any designer, engineer, programmer, technical writer or other person who contributed to the Font Software. PERMISSION &#38; CONDITIONS Permission is hereby granted, free of charge, to any person obtaining a copy of the Font Software, to use, study, copy, merge, embed, modify, redistribute, and sell modified and unmodified copies of the Font Software, subject to the following conditions: 1\) Neither the Font Software nor any of its individual components, in Original or Modified Versions, may be sold by itself. 2\) Original or Modified Versions of the Font Software may be bundled, redistributed and/or sold with any software, provided that each copy contains the above copyright notice and this license. These can be included either as stand-alone text files, human-readable headers or in the appropriate machine-readable metadata fields within text or binary files as long as those fields can be easily viewed by the user. 3\) No Modified Version of the Font Software may use the Reserved Font Name\(s\) unless explicit written permission is granted by the corresponding Copyright Holder. This restriction only applies to the primary font name as presented to the users. 4\) The name\(s\) of the Copyright Holder\(s\) or the Author\(s\) of the Font Software shall not be used to promote, endorse or advertise any Modified Version, except to acknowledge the contribution\(s\) of the Copyright Holder\(s\) and the Author\(s\) or with their explicit written permission. 5\) The Font Software, modified or unmodified, in part or in whole, must be distributed entirely under this license, and must not be distributed under any other license. The requirement for fonts to remain under this license does not apply to any document created using the Font Software. TERMINATION This license becomes null and void if any of the above conditions are not met. DISCLAIMER THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM OTHER DEALINGS IN THE FONT SOFTWARE.
</metadata>
<defs>
<font id="Bravura" horiz-adv-x="500" >
  <font-face
    font-family="Bravura"
    font-weight="400"
    font-stretch="normal"
    units-per-em="1000"
    panose-1="0 0 0 0 0 0 0 0 0 0"
    ascent="800"
    descent="-200"
    bbox="-434 -1992 2319 1951"
    underline-thickness="50"
    underline-position="-100"
    stemh="32"
    stemv="30"
    unicode-range="U+0020-1D1E8"
  />
<missing-glyph horiz-adv-x="297"
 />
    <glyph glyph-name="uniE527" unicode="&#xe520;&#xe520;&#xe520;&#xe520;&#xe520;&#xe520;" horiz-adv-x="2124"
d="M261 274c56 0 92 -31 92 -89c0 -95 -78 -195 -174 -195c-17 0 -30 2 -44 9c-16 8 -19 18 -24 18s-7 -7 -9 -12l-45 -112c-1 -3 -2 -6 -2 -7c0 -3 3 -3 9 -3h40c8 0 12 -4 12 -12c0 -9 -4 -13 -13 -13h-193c-8 0 -12 4 -12 12c0 9 4 13 13 13h31c10 0 12 2 15 10l123 305
c3 7 6 17 6 25c0 7 -3 12 -11 12c-18 0 -38 -26 -67 -76c-5 -9 -9 -15 -16 -15c-6 0 -11 4 -11 11c0 5 2 10 7 19c31 57 63 99 122 99c26 0 41 -9 48 -21c9 -17 6 -24 11 -24c4 0 7 8 21 20c18 16 40 26 71 26zM616 274c56 0 92 -31 92 -89c0 -95 -78 -195 -174 -195
c-17 0 -30 2 -44 9c-16 8 -19 18 -24 18s-7 -7 -9 -12l-45 -112c-1 -3 -2 -6 -2 -7c0 -3 3 -3 9 -3h40c8 0 12 -4 12 -12c0 -9 -4 -13 -13 -13h-193c-8 0 -12 4 -12 12c0 9 4 13 13 13h31c10 0 12 2 15 10l123 305c3 7 6 17 6 25c0 7 -3 12 -11 12c-15 0 -28 -17 -38 -30
c-2 -2 -4 -6 -4 -6c-5 -7 -9 -12 -16 -12c-6 0 -11 3 -11 10c0 5 2 10 8 19c22 31 48 57 96 57c26 0 41 -9 48 -21c9 -17 6 -24 11 -24c4 0 7 8 21 20c18 16 40 26 71 26zM971 274c56 0 92 -31 92 -89c0 -95 -78 -195 -174 -195c-17 0 -30 2 -44 9c-16 8 -19 18 -24 18
s-7 -7 -9 -12l-45 -112c-1 -3 -2 -6 -2 -7c0 -3 3 -3 9 -3h40c8 0 12 -4 12 -12c0 -9 -4 -13 -13 -13h-193c-8 0 -12 4 -12 12c0 9 4 13 13 13h31c10 0 12 2 15 10l123 305c3 7 6 17 6 25c0 7 -3 12 -11 12c-

## https://github.com/rism-digital/verovio/blob/version-6.3.0/fonts/Leipzig/Leipzig.svg

<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd" >
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1">
<metadata>
Created by FontForge 20251009 at Mon Aug  3 13:10:12 2026
 By Laurent Pugin
Created by Etienne Darbellay, Jean-Francois Marti, Laurent Pugin, and Klaus Rettinghaus.
This font is licensed under the SIL Open Font License \(https://openfontlicense.org/\).
Version 5.2.102
</metadata>
<defs>
<font id="Leipzig" horiz-adv-x="624" >
  <font-face
    font-family="Leipzig"
    font-weight="500"
    font-stretch="normal"
    units-per-em="1000"
    panose-1="2 0 5 3 0 0 0 0 0 0"
    ascent="800"
    descent="-200"
    bbox="-369 -1140 1833 1837"
    underline-thickness="50"
    underline-position="-100"
    unicode-range="U+0020-F4C0"
  />
    <missing-glyph />
    <glyph glyph-name="uniE0A3" unicode="&#xe0a3;" horiz-adv-x="314"
d="M278 64c0 22 -17 39 -43 39c-12 0 -26 -3 -41 -10c-85 -43 -165 -94 -165 -156c5 -25 15 -32 49 -32c67 11 200 95 200 159zM0 -36c0 68 73 174 200 174c66 0 114 -39 114 -97c0 -84 -106 -173 -218 -173c-64 0 -96 32 -96 96z" />
    <glyph glyph-name="uniE080" unicode="&#xe080;" horiz-adv-x="454"
d="M229 251zM230 -250c-99 0 -210 94 -210 251c0 152 93 250 209 250s205 -119 205 -250c0 -139 -103 -251 -204 -251zM139 1c0 -79 13 -215 88 -215c68 0 84 112 84 215c0 76 -15 216 -84 216c-68 0 -88 -136 -88 -216z" />
    <glyph glyph-name="uniE081" unicode="&#xe081;" horiz-adv-x="336"
d="M68 -250v36c23 0 40 6 49 18c8 14 12 33 12 57v250l-82 -129l-27 13l107 255h128v-394c0 -24 5 -42 14 -53s25 -17 47 -17v-36h-248z" />
    <glyph glyph-name="uniE082" unicode="&#xe082;" horiz-adv-x="442"
d="M124 -185c-18 0 -55 -14 -65 -65h-36l-3 30c0 25 6 45 18 63c11 19 22 30 39 43l121 82l37 29c15 11 27 29 38 54c12 24 18 47 18 70c0 40 -19 88 -94 88c-25 0 -32 0 -50 -8c-14 -5 -23 -12 -26 -22c3 -9 7 -15 10 -18l24 -17c12 -7 17 -11 27 -21c5 -7 7 -16 7 -27
c0 -12 0 -57 -79 -74c-30 0 -76 26 -76 94c0 66 81 135 197 135c72 0 181 -32 181 -150c0 -53 -32 -95 -113 -133l-91 -41c-26 -11 -45 -23 -57 -37l49 7c84 0 115 -41 148 -41c20 0 33 20 39 61h35c0 -152 -68 -168 -114 -168c-17 0 -65 0 -79 7h10l-28 17
c-49 37 -69 40 -87 42z" />
    <glyph glyph-name="uniE083" unicode="&#xe083;" horiz-adv-x="412"
d="M208 250c97 0 177 -52 177 -116c0 -69 -40 -111 -118 -125c56 -5 125 -44 125 -116c0 -31 -10 -57 -31 -78c-19 -21 -45 -38 -78 -49l-50 -11c-15 -3 -36 -7 -55 -7c-50 0 -86 16 -113 38c-16 10 -23 18 -34 34c-7 13 -11 25 -11 38c0 43 27 83 68 83l3 -2
c61 0 75 -42 75 -70c0 -19 -24 -42 -26 -57c7 -17 20 -25 37 -25c44 0 94 29 94 78c0 75 -34 125 -138 125v36c84 0 131 22 131 98c0 54 -37 88 -87 88c-26 0 -43 -7 -51 -22c15 -22 44 -16 44 -70c0 -37 -37 -62 -71 -62c-22 0 -69 15 -69 76c0 79 101 116 178 116z" />
    <glyph glyph-name="uniE084" unicode="&#xe084;" horiz-adv-x="427"
d="M20 -78c84 97 114 180 134 329h170c-13 -32 -82 -132 -99 -151l-84 -97c-33 -36 -59 -63 -80 -81h162v102l127 123v-225h57v-39h-57v-34c0 -43 19 -65 57 -65v-34h-244v36c48 0 60 26 60 70v27h-203v39z" />
    <glyph glyph-name="uniE085" unicode="&#xe085;" horiz-adv-x="397"
d="M161 38c-14 0 -56 -5 -92 -51h-32l5 263c55 -11 108 -18 158 -18c40 0 85 6 134 17c-8 -52 -39 -114 -159 -114l-50 2c-19 2 -31 4 -49 10l-5 -111c38 26 81 39 129 39c94 0 177 -64 177 -159c0 -100 -98 -166 -211 -166c-88 0 -146 53 -146 115c0 53 39 83 75 83
c37 0 69 -32 69 -72c0 -4 -1 -10 -4 -18l-27 -37c-2 -3 -3 -8 -3 -14c0 -15 12 -23 36 -23c74 0 92 77 92 132s-35 122 -97 122z" />
    <glyph glyph-name="uniE086" unicode="&#xe086;" horiz-adv-x="422"
d="M284 -91c0 37 -28 92 -67 92c-35 0 -65 -54 -65 -111c0 -52 22 -104 68 -104c47 0 64 68 64 123zM230 214c-36 0 -90 -33 -90 -184l2 -36c40 24 81 36 120 36c80 0 140 -48 140 -121c0 -99 -99 -159 -182 -159c-160 0 -200 173 -200 244c0 21 2 43 7 71l10 35
c26 85 73 115 98 126c41 19 74 24 103 24c93 0 142 -63 142 -105c0 -58 -52 -72 -73 -72c-33 0 -59 24 -65 35c-3 5 -6 14 -7 25l11 30c6 15 9 27 9 35c0 11 -9 16 -25 16z" />
    <glyph glyph-name="uniE087" unicode="&#xe087;" horiz-adv-x="444"
d="M350 125c-11 -9 -53 -46 -95 -46c-18 2 -33 8 -44 17c-17 19 -33 34 -48 45c-13 11 -27 17 -42 17c-23 0 -45 -22 -64 -66h-37v155h37c4 -18 11 -28 21 -30c8 1 15 3 22 8l10 5l14 10c3 2 14 6 21 7l11 2c8 1 33 1 42 1c39 0 57 -7 90 -43c11 -15 26 -23 44 -26
c27 3 45 29 54 70l38 -1c-1 -9 -11 -88 -29 -124c-5 -13 -12 -28 -21 -46l-33 -60c-55 -92 -69 -162 -69 -270h-174c0 45 11 86 33 122c23 35 59 74 106 117c99 84 113 96 113 136z" />
    <glyph glyph-name="uniE088" unicode="&#xe088;" horiz-adv-x="404"
d="M195 -214c76 0 88 58 90 68c0 34 -35 60 -57 73l-52 29c-21 10 -32 17 -34 20c-39 -33 -58 -54 -62 -92c5 -23 23 -98 115 -98zM301 135c0 61 -72 76 -113 76c-40 0 -77 -17 -77 -51c3 -21 15 -38 26 -50c17 -15 33 -26 48 -34l65 -28c34 27 51 56 51 87zM176 -250
c-57 0 -166 26 -166 132c0 47 30 86 89 116c-33 15 -79 60 -79 119c0 79 85 132 178 132h18c5 0 21 1 28 -1c25 0 126 -30 126 -110c0 -37 -23 -76 -69 -116c43 -25 83 -71 83 -119c0 -101 -118 -153 -208 -153z" />
    <glyph glyph-name="uniE089" unicode="&#xe089;" horiz-adv-x="425"
d="M139 107c0 -51 22 -104 66 -104c38 0 64 48 64 110c0 50 -31 100 -64 100c-40 0 -66 -56 -66 -106zM114 -74c40 0 72 -27 72 -65c0 -8 -3 -19 -9 -34l-7 -16l-5 -15c2 -8 12 -12 31 -12c56 0 84 73 84 219c-32 -24 -71 -36 -119 -36c-29 0 -56 6 -79 20
c-51 26 -57 78 -62 108c0 64 56 155 188 155c158 0 197 -151 197 -237c0 -145 -92 -263 -207 -263c-109 0 -155 68 -155 101c0 46 33 75 71 75z" />
    <glyph glyph-name="uniE0A2" unicode="&#xe0a2;" horiz-adv-x="405"
d="M198 133c102 0 207 -45 207 -133c0 -92 -118 -133 -227 -133c-101 0 -178 46 -178 133c0 88 93 133 198 133zM293 -21c0 14 -3 29 -8 44c-7 20 -18 38 -33 54c-20 21 -43 31 -68 31l-20 -2c-15 -5 -27 -14 -36 -28c-4 -9 -6 -17 -8 -24s-3 -16 -3 -27c0 -15 3 -34 9 -57
s18 -41 34 -55c15 -15 36 -23 62 -23c4 0 10 1 18 2c19 5 32 15 40 30s13 34 13 55z" />
    <glyph glyph-name="uniE0A4" unicode="&#xe0a4;" horiz-adv-x="314"
d="M0 -39c0 68 73 172 200 172c66 0 114 -37 114 -95c0 -84 -106 -171 -218 -171c-64 0 -96 30 -96 94z" />
    <glyph glyph-name="uniE05C" unicode="&#xe05c;" horiz-adv-x="606"
d="M175 502h43v-456c10 5 18 12 37 29c16 19 22 27 27 38s8 24 14 49c3 22 5 43 5 62c7 -34 31 -54 73 -60c73 18 99 61 100 165c0 46 -10 78 -31 100c-18 23 -41 35 -69 35c-40 0 -65 -32 -66 -84c6 12 11 16 39 24c5 0 2 1 16 -4l17 -10l10 -14l7 -18
c-4 -32 -23 -48 -56 -48c-51 0 -77 33 -77 98c10 35 16 47 30 61c9 9 15 14 23 17c3 3 22 9 27 11l34 3l35 2c123 0 192 -64 192 -178l1 -33c0 -52 -20 -97

## Liberation text font

Exact version/attribution: [Liberation-NOTICE.txt](Liberation-NOTICE.txt).
License: [Liberation-LICENSE.txt](Liberation-LICENSE.txt) and [GPL-2.0.txt](GPL-2.0.txt).
License source: https://raw.githubusercontent.com/liberationfonts/liberation-1.7-fonts/master/License.txt
Version history/license distinction: https://github.com/liberationfonts/liberation-1.7-fonts
The 1.04 identity was read from the embedded WOFF2 name table, not inferred
from the present-day font project's license. The exact input lives in
verovio-version-6.3.0/data/Liberation.css in the retained archive. The standalone
WOFF2 is the identical decoded data URL; the TTF is a lossless decompression
with fontTools 4.x/WOFF2 support, retaining the same glyphs/names and version.
Runtime JS/WASM is unmodified. Replace a module in place to test an
interface-compatible build; rebuild instructions are emscripten/buildToolkit
in the corresponding source archive. No separate build is needed for the
plain JavaScript application modules or the static site.
